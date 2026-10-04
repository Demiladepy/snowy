// Browser-side NDJSON reader for the API routes.

import type {StreamEvent} from './ndjson'

export async function readNdjson(res: Response, onEvent: (e: StreamEvent) => void): Promise<void> {
  if (!res.ok || !res.body) {
    let message = `HTTP ${res.status}`
    try {
      message = ((await res.json()) as {error?: string}).error ?? message
    } catch {}
    throw new Error(message)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const {done, value} = await reader.read()
    if (done) break
    buffer += decoder.decode(value, {stream: true})
    let nl: number
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (line) onEvent(JSON.parse(line) as StreamEvent)
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as StreamEvent)
}
