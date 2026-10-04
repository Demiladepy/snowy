// Strip anything that looks like a secret before user input reaches the LLM.

const PATTERNS: RegExp[] = [
  /\bsk[A-Za-z0-9_-]{16,}\b/g, // Sanity tokens (skXXXX...), also OpenAI-style sk-...
  /\b(?:ghp|gho|github_pat|xox[abp])_[A-Za-z0-9_]{16,}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, // JWT
  /\b[A-Za-z0-9+/_-]{40,}={0,2}(?![A-Za-z0-9])/g, // long base64-ish blobs
]

export function redactSecrets(input: string): {text: string; redactions: number} {
  let redactions = 0
  let text = input
  for (const re of PATTERNS) {
    text = text.replace(re, () => {
      redactions++
      return '[REDACTED]'
    })
  }
  return {text, redactions}
}
