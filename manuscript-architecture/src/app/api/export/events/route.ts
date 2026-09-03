import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const events = await db.event.findMany({ orderBy: { id: 'asc' } })
  const payload = {
    exportedAt: new Date().toISOString(),
    system: 'The Manuscript Architecture — prototype',
    count: events.length,
    events: events.map((e) => ({
      id: e.id,
      createdAt: e.createdAt.toISOString(),
      type: e.type,
      actor: e.actor,
      payload: safeParse(e.payload),
    })),
  }
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="manuscript-events.json"',
    },
  })
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}
