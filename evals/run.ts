// Three-arm ablation eval.
//   A — model alone:   "Review this Sanity config; list issues as JSON {issue, apiVersionBoundary}"
//   B — model + KB:    same prompt, with the Sanity Context Knowledge Base tools
//   C — Pinned:        facts + rule engine (rules from the dataset); explanations don't affect the metrics
//
// Usage: npm run eval            (all arms that are configured)
//        npm run eval -- C       (only arm C — needs no API keys)
// Writes evals/results.md and evals/results.json.

import {writeFileSync} from 'node:fs'
import {generateText, isStepCount, Output} from 'ai'
import {z} from 'zod'
import {llmConfigured, MODEL_ID, model} from '../lib/agent'
import {evaluate} from '../lib/engine'
import {extractFacts} from '../lib/facts'
import {contextConfigured, getInitialContext, knowledgeBaseId, openKnowledgeBaseTools} from '../lib/mcp'
import {loadRules} from '../lib/rules'
import type {Rule} from '../lib/types'
import {EVAL_CASES, type EvalCaseData} from '../scripts/eval-cases'
import {judge, type FreeTextIssue} from './judge'

type Arm = 'A' | 'B' | 'C'

interface CaseResult {
  caseId: string
  group: EvalCaseData['group']
  expected: string[]
  predicted: string[]
  boundaries: Record<string, string | null>
  cited: boolean
  rawIssues?: FreeTextIssue[]
  error?: string
}

const REVIEW_PROMPT = (c: EvalCaseData) =>
  `Review this Sanity config; list issues as JSON {issue, apiVersionBoundary}. apiVersionBoundary is the API version date (YYYY-MM-DD) at which the behavior changes, or null.

\`\`\`ts
${c.config}
\`\`\`${c.packageJson ? `\n\npackage.json:\n\`\`\`json\n${c.packageJson}\n\`\`\`` : ''}`

const IssuesSchema = z.object({
  issues: z.array(z.object({issue: z.string(), apiVersionBoundary: z.string().nullable()})),
})

async function runModelArm(arm: 'A' | 'B', c: EvalCaseData, rules: Rule[]): Promise<CaseResult> {
  const base: CaseResult = {caseId: c.id, group: c.group, expected: c.expectedRuleIds, predicted: [], boundaries: {}, cited: false}
  let mcp: Awaited<ReturnType<typeof openKnowledgeBaseTools>> | undefined
  try {
    let instructions = 'You are reviewing Sanity client code.'
    let tools = {}
    if (arm === 'B') {
      const initialContext = await getInitialContext()
      mcp = await openKnowledgeBaseTools()
      tools = mcp.tools
      instructions += `\nUse knowledge_base_search and knowledge_base_read (Knowledge Base id: ${knowledgeBaseId(initialContext) ?? 'see outline'}) to check Sanity's docs before answering.\n\n# Knowledge Base outline\n${initialContext}`
    }
    const call = () => generateText({
      model,
      instructions,
      prompt: REVIEW_PROMPT(c),
      tools,
      stopWhen: isStepCount(arm === 'B' ? 6 : 1),
      output: Output.object({schema: IssuesSchema}),
      maxOutputTokens: 1500,
    })
    // One retry: structured output occasionally fails to parse.
    const result = await call().catch(() => call())
    const issues = result.output?.issues ?? []
    const judged = await judge(issues, rules)
    const cited = result.steps.some((s) => s.toolCalls.some((t) => t.toolName.startsWith('knowledge_base_')))
    return {...base, predicted: judged.ruleIds, boundaries: judged.boundaries, cited, rawIssues: issues}
  } catch (err) {
    return {...base, error: (err as Error).message}
  } finally {
    await mcp?.client.close()
  }
}

function runPinned(c: EvalCaseData, rules: Rule[]): CaseResult {
  const findings = evaluate(extractFacts({code: c.config, packageJson: c.packageJson}), rules)
  const boundaries: Record<string, string | null> = {}
  for (const f of findings) boundaries[f.ruleId] = rules.find((r) => r.ruleId === f.ruleId)?.boundary?.apiVersion ?? null
  return {
    caseId: c.id,
    group: c.group,
    expected: c.expectedRuleIds,
    predicted: findings.map((f) => f.ruleId),
    boundaries,
    cited: findings.every((f) => f.sources.length > 0),
  }
}

interface Metrics {
  cases: number
  errors: number
  precision: number
  recall: number
  exactCases: number
  boundaryCorrect: number
  boundaryTotal: number
  citedCases: number
  falseCriticalsOnModern: number
}

function score(results: CaseResult[], rules: Rule[]): Metrics {
  let tp = 0
  let fp = 0
  let fn = 0
  let exact = 0
  let bCorrect = 0
  let bTotal = 0
  let falseCrit = 0
  for (const r of results) {
    const exp = new Set(r.expected)
    const pred = new Set(r.predicted)
    for (const p of pred) {
      if (exp.has(p)) tp++
      else fp++
    }
    for (const e of exp) if (!pred.has(e)) fn++
    if (!r.error && exp.size === pred.size && [...exp].every((e) => pred.has(e))) exact++
    for (const id of pred) {
      const truth = rules.find((x) => x.ruleId === id)?.boundary?.apiVersion
      if (!truth || !exp.has(id)) continue
      bTotal++
      if ((r.boundaries[id] ?? '').replace(/^v/, '') === truth) bCorrect++
    }
    if (r.group === 'modern') falseCrit += r.predicted.filter((id) => rules.find((x) => x.ruleId === id)?.severity === 'critical').length
  }
  return {
    cases: results.length,
    errors: results.filter((r) => r.error).length,
    precision: tp + fp ? tp / (tp + fp) : 1,
    recall: tp + fn ? tp / (tp + fn) : 1,
    exactCases: exact,
    boundaryCorrect: bCorrect,
    boundaryTotal: bTotal,
    citedCases: results.filter((r) => r.cited).length,
    falseCriticalsOnModern: falseCrit,
  }
}

const pct = (n: number) => `${Math.round(n * 100)}%`

async function main() {
  const requested = (process.argv.slice(2).filter((a) => /^[ABC]$/.test(a)) as Arm[]) || []
  const arms: Arm[] = requested.length ? requested : ['A', 'B', 'C']
  const {rules, origin} = await loadRules()
  const notes: string[] = [
    `Rules: ${rules.length} from ${origin}.`,
    'Caveat: the cases and their expected rule IDs were written by the same author as the rules, and two engine gaps they exposed were fixed before this run. Arm C’s score shows the engine matches its documented rules, not held-out accuracy.',
  ]
  const all: Partial<Record<Arm, {results: CaseResult[]; metrics: Metrics}>> = {}

  for (const arm of arms) {
    if (arm !== 'C' && !llmConfigured) {
      notes.push(`Arm ${arm} skipped: ANTHROPIC_API_KEY is not set.`)
      continue
    }
    if (arm === 'B' && !contextConfigured) {
      notes.push('Arm B skipped: Sanity Context MCP endpoint is not configured.')
      continue
    }
    const results: CaseResult[] = []
    for (const c of EVAL_CASES) {
      process.stdout.write(`arm ${arm} · ${c.id}… `)
      const r = arm === 'C' ? runPinned(c, rules) : await runModelArm(arm, c, rules)
      results.push(r)
      console.log(r.error ? `error: ${r.error}` : r.predicted.join(', ') || '(none)')
    }
    all[arm] = {results, metrics: score(results, rules)}
  }

  const rows = (['A', 'B', 'C'] as Arm[])
    .filter((a) => all[a])
    .map((a) => {
      const m = all[a]!.metrics
      const label = {A: 'A — model alone', B: 'B — model + KB', C: 'C — Pinned (engine)'}[a]
      return `| ${label} | ${pct(m.precision)} | ${pct(m.recall)} | ${m.exactCases}/${m.cases} | ${m.boundaryTotal ? `${m.boundaryCorrect}/${m.boundaryTotal}` : '—'} | ${m.citedCases}/${m.cases} | ${m.falseCriticalsOnModern} | ${m.errors} |`
    })

  const perCase = EVAL_CASES.map((c) => {
    const cell = (a: Arm) => {
      const r = all[a]?.results.find((x) => x.caseId === c.id)
      if (!r) return '—'
      if (r.error) return 'error'
      const ok = r.predicted.length === c.expectedRuleIds.length && c.expectedRuleIds.every((e) => r.predicted.includes(e))
      return `${ok ? '✓' : '✗'} ${r.predicted.join(', ') || '(none)'}`
    }
    return `| ${c.id} | ${c.expectedRuleIds.join(', ') || '(none)'} | ${cell('A')} | ${cell('B')} | ${cell('C')} |`
  })

  // A hallucinated-boundary example, if arm A produced one.
  const halluc = all.A?.results
    .flatMap((r) => (r.rawIssues ?? []).map((i) => ({caseId: r.caseId, ...i})))
    .find((i) => i.apiVersionBoundary && !rules.some((r) => r.boundary?.apiVersion === i.apiVersionBoundary?.replace(/^v/, '')))

  const md = `# Eval results

Generated ${new Date().toISOString()} · model \`${MODEL_ID}\` · ${EVAL_CASES.length} cases (5 tutorial, 4 Studio, 3 modern, 3 tricky).

${notes.map((n) => `- ${n}`).join('\n')}

| Arm | Precision | Recall | Exact cases | Boundary correct | Cited | False criticals on modern configs | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

- **Precision / recall** are over expected rule IDs. Free-text answers from A and B are mapped to rule IDs by a fixed judge prompt (\`evals/judge.ts\`). Spot-check 20% of mappings by hand before quoting them.
- **Boundary correct** counts true positives that stated the exact boundary date. Arm C takes boundaries from the rule documents, so it's correct by construction. The interesting comparison is between A and B.
- **Cited:** for B, the model called \`knowledge_base_read\`. For C, every finding carries at least one source with quoted evidence.
${halluc ? `\n**Example of a boundary arm A made up** (${halluc.caseId}): “${halluc.issue}” → \`${halluc.apiVersionBoundary}\`, which matches no documented boundary.\n` : ''}
## Per case

| Case | Expected | A | B | C |
| --- | --- | --- | --- | --- |
${perCase.join('\n')}
`
  writeFileSync('evals/results.md', md)
  writeFileSync('evals/results.json', JSON.stringify({model: MODEL_ID, notes, arms: all}, null, 2))
  console.log('\nWrote evals/results.md')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
