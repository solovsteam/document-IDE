// SSE stream: polls the Event table and pushes new events to the client.

import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  let cursor = Number(url.searchParams.get('since') ?? '0')
  if (!Number.isFinite(cursor) || cursor < 0) cursor = 0

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      let ticks = 0

      const send = (obj: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
        } catch {
          closed = true
        }
      }

      const heartbeat = () => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`: hb\n\n`))
        } catch {
          closed = true
        }
      }

      send({
        id: 0,
        type: 'hello',
        actor: 'system',
        payload: { cursor },
        createdAt: new Date().toISOString(),
      })

      const poll = async () => {
        if (closed) return
        try {
          const rows = await db.event.findMany({
            where: { id: { gt: cursor } },
            orderBy: { id: 'asc' },
            take: 100,
          })
          for (const row of rows) {
            cursor = row.id
            send({
              id: row.id,
              type: row.type,
              actor: row.actor,
              payload: safeParse(row.payload),
              createdAt: row.createdAt.toISOString(),
            })
          }
          ticks += 1
          if (ticks % 20 === 0) heartbeat()
        } catch (err) {
          console.error('[sse] poll failed:', err)
        }
      }

      const interval = setInterval(() => {
        void poll()
      }, 400)

      const cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(interval)
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }

      req.signal.addEventListener('abort', cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}
