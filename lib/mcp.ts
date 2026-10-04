// Sanity Context MCP (Knowledge Base mode).
// Per https://www.sanity.io/docs/ai/sanity-context-vercel-ai-sdk : fetch initial context over HTTP
// (`<endpoint>/initial-context`), put it in the system prompt, and drop the `initial_context` tool.
// In KB mode the remaining tool is `knowledge_base_read` (https://www.sanity.io/docs/ai/sanity-context-mcp-tools).

import {createMCPClient} from '@ai-sdk/mcp'

const MCP_URL = process.env.SANITY_CONTEXT_MCP_URL
const TOKEN = process.env.SANITY_ORG_CONTEXT_TOKEN

export const contextConfigured = Boolean(MCP_URL && TOKEN)

const INITIAL_CONTEXT_TTL_MS = 10 * 60 * 1000
let initialContextCache: {at: number; text: string} | null = null

export async function getInitialContext(): Promise<string> {
  if (!MCP_URL || !TOKEN) throw new Error('Sanity Context is not configured')
  if (initialContextCache && Date.now() - initialContextCache.at < INITIAL_CONTEXT_TTL_MS) return initialContextCache.text
  // Append to the path, not the whole URL, so query parameters survive.
  const url = new URL(MCP_URL)
  url.pathname = `${url.pathname.replace(/\/$/, '')}/initial-context`
  const res = await fetch(url, {headers: {Authorization: `Bearer ${TOKEN}`}})
  if (!res.ok) throw new Error(`initial-context: HTTP ${res.status}`)
  const text = await res.text()
  initialContextCache = {at: Date.now(), text}
  return text
}

/** Knowledge Base id (`kb…`) from the "Knowledge base id:" line of the outline. */
export function knowledgeBaseId(initialContext: string): string | undefined {
  return process.env.SANITY_KB_ID || /Knowledge base id:\s*(kb\w+)/i.exec(initialContext)?.[1]
}

/** Open an MCP client and return its tools minus `initial_context`. Caller must `close()`. */
export async function openKnowledgeBaseTools() {
  if (!MCP_URL || !TOKEN) throw new Error('Sanity Context is not configured')
  const client = await createMCPClient({
    transport: {type: 'http', url: MCP_URL, headers: {Authorization: `Bearer ${TOKEN}`}},
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {initial_context: _omit, ...tools} = await client.tools()
  return {client, tools}
}
