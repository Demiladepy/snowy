import {isStepCount, streamText} from 'ai'
import {evaluate} from '@/lib/engine'
import {extractFacts} from '@/lib/facts'
import {explainInstructions, explainPrompt, llmConfigured, model} from '@/lib/agent'
import {contextConfigured, getInitialContext, knowledgeBaseId, openKnowledgeBaseTools} from '@/lib/mcp'
import {jsonError, ndjsonStream, type FactsSummary, type StreamEvent} from '@/lib/ndjson'
import {clientIp, MAX_INPUT_BYTES, rateLimit} from '@/lib/ratelimit'
import {redactSecrets} from '@/lib/redact'
import {loadRules} from '@/lib/rules'
import type {ClientFacts, Facts, Finding} from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_EXPLAINED = 6

function describeValue(v: ClientFacts['perspective'] | ClientFacts['useCdn']): string {
  if (v.kind === 'unset') return 'unset'
  if (v.kind === 'dynamic') return `dynamic (${v.expression})`
  return Array.isArray(v.value) ? `[${v.value.join(', ')}]` : String(v.value)
}

function summarize(facts: Facts): FactsSummary {
  return {
    clients: facts.clients.map((c) => ({
      callSite: c.callSite,
      line: c.line,
      apiVersion:
        c.apiVersion.kind === 'date'
          ? c.apiVersion.value + (c.apiVersion.viaFallback ? ` (fallback of ${c.apiVersion.viaFallback})` : '')
          : c.apiVersion.kind === 'dynamic'
            ? `dynamic (${c.apiVersion.expression})`
            : c.apiVersion.kind,
      perspective: describeValue(c.perspective),
      token: c.token.present,
      useCdn: describeValue(c.useCdn),
    })),
    queries: facts.queries.length,
    listenCalls: facts.listenCalls.length,
    packages: facts.packages,
  }
}

async function explain(
  send: (e: StreamEvent) => void,
  findings: Finding[],
  redactedCode: string,
  signal: AbortSignal,
): Promise<void> {
  const initialContext = await getInitialContext()
  const kbId = knowledgeBaseId(initialContext)
  const {client, tools} = await openKnowledgeBaseTools()
  try {
    await Promise.all(
      findings.slice(0, MAX_EXPLAINED).map(async (finding) => {
        const ruleId = finding.ruleId
        send({type: 'explain-start', ruleId})
        try {
          const result = streamText({
            model,
            instructions: explainInstructions(initialContext, kbId),
            prompt: explainPrompt(finding, redactedCode),
            tools,
            stopWhen: isStepCount(4),
            maxOutputTokens: 600,
            abortSignal: signal,
          })
          for await (const part of result.fullStream) {
            if (part.type === 'text-delta') send({type: 'text', ruleId, text: part.text})
            else if (part.type === 'tool-call' && part.toolName === 'knowledge_base_read') {
              const paths = (part.input as {paths?: string[]})?.paths ?? []
              send({type: 'kb-read', ruleId, paths})
            } else if (part.type === 'tool-call' && part.toolName === 'knowledge_base_search') {
              send({type: 'kb-read', ruleId, paths: [`search: ${(part.input as {query?: string})?.query ?? ''}`]})
            } else if (part.type === 'error') send({type: 'error', ruleId, message: String(part.error)})
          }
        } catch (err) {
          send({type: 'error', ruleId, message: (err as Error).message})
        } finally {
          send({type: 'explain-end', ruleId})
        }
      }),
    )
  } finally {
    await client.close()
  }
}

export async function POST(req: Request): Promise<Response> {
  const limit = rateLimit(clientIp(req))
  if (!limit.ok) return jsonError(429, 'Rate limit reached. Try again later.', {'Retry-After': String(limit.retryAfterSec)})

  const raw = await req.text()
  if (raw.length > MAX_INPUT_BYTES * 3) return jsonError(413, 'Input too large (max 20 KB per field).')
  let body: {code?: string; packageJson?: string; queries?: string; explain?: boolean}
  try {
    body = JSON.parse(raw)
  } catch {
    return jsonError(400, 'Body must be JSON.')
  }
  const code = body.code ?? ''
  const packageJson = body.packageJson ?? ''
  const queries = body.queries ?? ''
  if ([code, packageJson, queries].some((s) => typeof s !== 'string' || s.length > MAX_INPUT_BYTES)) {
    return jsonError(413, 'Each field must be a string of at most 20 KB.')
  }
  if (!code.trim() && !packageJson.trim() && !queries.trim()) return jsonError(400, 'Paste a client config to analyze.')

  return ndjsonStream(async (send) => {
    // 1–3: deterministic. Parse, load rules, evaluate. No LLM.
    const facts = extractFacts({code, packageJson, queries})
    const {rules, origin, error} = await loadRules()
    const findings = evaluate(facts, rules)
    const {text: redactedCode, redactions} = redactSecrets(code)

    send({
      type: 'findings',
      findings,
      facts: summarize(facts),
      rulesOrigin: origin,
      rulesCount: rules.length,
      redactions,
      parseErrors: facts.parseErrors,
    })
    if (origin !== 'dataset') send({type: 'notice', message: `Rules loaded from the bundled seed (${error}).`})

    // 4: LLM explanations, cited from the Knowledge Base.
    if (body.explain === false || findings.length === 0) return
    if (!llmConfigured || !contextConfigured) {
      send({type: 'notice', message: 'Explanations are off: the server has no LLM key or Sanity Context endpoint configured.'})
      return
    }
    await explain(send, findings, redactedCode, req.signal)
  })
}
