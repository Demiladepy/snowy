// Best-effort per-IP rate limit. In-memory, so it's per serverless instance — good enough for a demo.

const LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR || 20)
const WINDOW_MS = 60 * 60 * 1000
const hits = new Map<string, number[]>()

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local'
}

/** Returns ok=false when the key is over the limit; otherwise records the hit. */
export function rateLimit(key: string): {ok: boolean; retryAfterSec: number} {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= LIMIT) {
    hits.set(key, recent)
    return {ok: false, retryAfterSec: Math.ceil((WINDOW_MS - (now - recent[0])) / 1000)}
  }
  recent.push(now)
  hits.set(key, recent)
  return {ok: true, retryAfterSec: 0}
}

export const MAX_INPUT_BYTES = 20 * 1024
