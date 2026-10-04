// LLM side: explains findings the engine already produced, and answers follow-ups.
// The model never decides what's wrong. It only explains, citing Knowledge Base entries.

import {anthropic} from '@ai-sdk/anthropic'
import type {Finding} from './types'

export const MODEL_ID = process.env.PINNED_MODEL || 'claude-sonnet-5-5'
export const model = anthropic(MODEL_ID)
export const llmConfigured = Boolean(process.env.ANTHROPIC_API_KEY)

const GROUND_RULES = `Ground rules:
- Only state an API version boundary (a date like 2025-02-19) or package version if it appears in the finding you were given or in a Knowledge Base entry you read. Never infer one.
- If the Knowledge Base doesn't cover something, say "not covered by the docs I have" instead of guessing.
- You have not run the user's code. Never claim you did.
- Cite every Knowledge Base entry you used as [kb: <entry path>] and include its original source URL when the entry gives one.
- Some docs claims are version-scoped: "the default perspective is raw" and "the default perspective is published" are both true on either side of 2025-02-19. Always state the boundary rather than treating one claim as universally true.`

export function explainInstructions(initialContext: string, kbId: string | undefined): string {
  return `You are Pinned, an assistant that explains version-dependent Sanity API behavior to developers.
A deterministic rule engine has already analyzed the user's code and produced one finding. Your job is to explain that finding for THIS user's code in at most 80 words.

Use knowledge_base_search to find relevant entries and knowledge_base_read (Knowledge Base id: ${kbId ?? 'see outline below'}) to read 1–3 of them before answering. Read several paths in one call.

${GROUND_RULES}

Format: plain prose, no headings, then one line "Sources: [kb: path] (url), ..." at the end.

# Knowledge Base outline
${initialContext}`
}

export function explainPrompt(finding: Finding, redactedCode: string): string {
  const {ruleId, severity, title, nowBehavior, afterBumpBehavior, fix, sources, line} = finding
  return `Finding (from the rule engine; treat as ground truth):
${JSON.stringify({ruleId, severity, title, line, nowBehavior, afterBumpBehavior, fix, sources: sources.map((s) => ({url: s.url, evidence: s.evidence}))}, null, 2)}

The user's code (secrets redacted):
\`\`\`ts
${redactedCode.slice(0, 4000)}
\`\`\`

Explain what this means for this code${line ? ` (line ${line})` : ''}.`
}

export function chatInstructions(initialContext: string, kbId: string | undefined, findingsSummary: string): string {
  return `You are Pinned, an assistant that answers follow-up questions about version-dependent Sanity API behavior.
Tools: knowledge_base_search and knowledge_base_read (Knowledge Base id: ${kbId ?? 'see outline below'}) reads Sanity documentation entries; get_rules lists Pinned's structured version-change rules from the Sanity dataset.

${GROUND_RULES}
- Keep answers under 200 words unless the user asks for more.

# Findings for the user's current code
${findingsSummary || '(no analysis run yet)'}

# Knowledge Base outline
${initialContext}`
}
