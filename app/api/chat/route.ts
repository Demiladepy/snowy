import {isStepCount, streamText, tool, type ModelMessage} from 'ai'
import {z} from 'zod'
import {chatInstructions, llmConfigured, model} from '@/lib/agent'
import {contextConfigured, getInitialContext, knowledgeBaseId, openKnowledgeBaseTools} from '@/lib/mcp'
import {jsonError, ndjsonStream} from '@/lib/ndjson'
import {clientIp, MAX_INPUT_BYTES, rateLimit} from '@/lib/ratelimit'
import {redactSecrets} from '@/lib/redact'
import {loadRules} from '@/lib/rules'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_MESSAGES = 12

const getRules = tool({
  description:
    "List Pinned's structured version-change rules (from the Sanity dataset). Optionally filter by area: perspective, apiVersion, releases, cdn, listen, groq, studio, client.",
  inputSchema: z.object({area: z.string().optional()}),
  execute: async ({area}) => {
    const {rules} = await loadRules()
    return rules
      .filter((r) => !area || r.area === area)
      .map((r) => ({
        ruleId: r.ruleId,
        title: r.title,
        severity: r.severity,
        boundary: r.boundary,
        conditions: r.conditions,
        nowBehavior: r.nowBehavior,
        afterBumpBehavior: r.afterBumpBehavior,
        fix: r.fix,
        sources: r.sources.map((s) => s.url),
      }))
  },
})

export async function POST(req: Request): Promise<Response> {
  const limit = rateLimit(clientIp(req))
  if (!limit.ok) return jsonError(429, 'Rate limit reached. Try again later.', {'Retry-After': String(limit.retryAfterSec)})
  if (!llmConfigured || !contextConfigured) return jsonError(503, 'Chat is unavailable: the LLM or Sanity Context is not configured.')

  let body: {messages?: {role: 'user' | 'assistant'; content: string}[]; findingsSummary?: string}
  try {
    body = await req.json()
  } catch {
    return jsonError(400, 'Body must be JSON.')
  }
  const messages = (body.messages ?? []).slice(-MAX_MESSAGES)
  if (!messages.length || messages.at(-1)?.role !== 'user') return jsonError(400, 'Send at least one user message.')
  if (messages.some((m) => typeof m.content !== 'string' || m.content.length > MAX_INPUT_BYTES)) {
    return jsonError(413, 'Message too large.')
  }
  const modelMessages: ModelMessage[] = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.role === 'user' ? redactSecrets(m.content).text : m.content,
  }))
  const findingsSummary = redactSecrets(String(body.findingsSummary ?? '').slice(0, 4000)).text

  return ndjsonStream(async (send) => {
    const initialContext = await getInitialContext()
    const kbId = knowledgeBaseId(initialContext)
    const {client, tools} = await openKnowledgeBaseTools()
    try {
      const result = streamText({
        model,
        instructions: chatInstructions(initialContext, kbId, findingsSummary),
        messages: modelMessages,
        tools: {...tools, get_rules: getRules},
        stopWhen: isStepCount(6),
        maxOutputTokens: 1200,
        abortSignal: req.signal,
      })
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') send({type: 'text', text: part.text})
        else if (part.type === 'tool-call' && part.toolName === 'knowledge_base_read') {
          send({type: 'kb-read', paths: (part.input as {paths?: string[]})?.paths ?? []})
        } else if (part.type === 'tool-call' && part.toolName === 'knowledge_base_search') {
          send({type: 'kb-read', paths: [`search: ${(part.input as {query?: string})?.query ?? ''}`]})
        } else if (part.type === 'tool-call' && part.toolName === 'get_rules') {
          send({type: 'kb-read', paths: ['dataset: *[_type == "rule"]']})
        } else if (part.type === 'error') send({type: 'error', message: String(part.error)})
      }
    } finally {
      await client.close()
    }
  })
}
