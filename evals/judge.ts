// Fixed judge prompt: maps free-text issues (arms A and B) onto Pinned rule IDs.
// The judge only sees rule IDs and titles, never the expected answer.

import {generateText, Output} from 'ai'
import {z} from 'zod'
import {model} from '../lib/agent'
import type {Rule} from '../lib/types'

export interface FreeTextIssue {
  issue: string
  apiVersionBoundary?: string | null
}

const JudgeSchema = z.object({
  matches: z.array(
    z.object({
      issueIndex: z.number().int(),
      ruleId: z.string().describe('A ruleId from the list, or "none"'),
    }),
  ),
})

export async function judge(issues: FreeTextIssue[], rules: Rule[]): Promise<{ruleIds: string[]; boundaries: Record<string, string | null>}> {
  if (!issues.length) return {ruleIds: [], boundaries: {}}
  const catalogue = rules.map((r) => `- ${r.ruleId}: ${r.title} (${r.nowBehavior.slice(0, 160)})`).join('\n')
  const {output} = await generateText({
    model,
    instructions:
      'You map code-review issues onto a fixed catalogue of rules. For each issue, pick the single ruleId it describes, or "none" if no rule matches closely. Do not infer issues that were not stated.',
    prompt: `Rule catalogue:\n${catalogue}\n\nIssues:\n${issues.map((i, n) => `${n}. ${i.issue}`).join('\n')}`,
    output: Output.object({schema: JudgeSchema}),
    maxOutputTokens: 800,
  })
  const boundaries: Record<string, string | null> = {}
  const ruleIds = new Set<string>()
  for (const m of output?.matches ?? []) {
    if (m.ruleId === 'none' || !rules.some((r) => r.ruleId === m.ruleId)) continue
    ruleIds.add(m.ruleId)
    boundaries[m.ruleId] = issues[m.issueIndex]?.apiVersionBoundary ?? null
  }
  return {ruleIds: [...ruleIds], boundaries}
}
