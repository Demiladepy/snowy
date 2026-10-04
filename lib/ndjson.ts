// Tiny NDJSON stream helper shared by the API routes.

export type StreamEvent =
  | {type: 'findings'; findings: import('./types').Finding[]; facts: FactsSummary; rulesOrigin: string; rulesCount: number; redactions: number; parseErrors: string[]}
  | {type: 'explain-start'; ruleId: string}
  | {type: 'text'; ruleId?: string; text: string}
  | {type: 'kb-read'; ruleId?: string; paths: string[]}
  | {type: 'explain-end'; ruleId: string}
  | {type: 'notice'; message: string}
  | {type: 'error'; ruleId?: string; message: string}
  | {type: 'done'}

export interface FactsSummary {
  clients: {callSite: string; line: number; apiVersion: string; perspective: string; token: boolean; useCdn: string}[]
  queries: number
  listenCalls: number
  packages: Record<string, string>
}

export function ndjsonStream(run: (send: (e: StreamEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'))
      try {
        await run(send)
      } catch (err) {
        send({type: 'error', message: (err as Error).message})
      } finally {
        send({type: 'done'})
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: {'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store'},
  })
}

export function jsonError(status: number, message: string, headers: Record<string, string> = {}): Response {
  return Response.json({error: message}, {status, headers})
}
