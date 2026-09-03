import { NextResponse } from 'next/server'
import { getOrchestratorState, pause, start } from '@/lib/server/orchestrator'
import { ensureSeed, resetSession } from '@/lib/server/seed'
import { errorResponse } from '@/lib/server/http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string }
    const action = body.action

    if (action === 'start') {
      await ensureSeed()
      start()
    } else if (action === 'pause') {
      pause()
    } else if (action === 'reset') {
      await resetSession()
    } else {
      return NextResponse.json(
        { error: `Unknown action: ${String(action)}` },
        { status: 400 },
      )
    }

    return NextResponse.json({ ok: true, ...getOrchestratorState() })
  } catch (err) {
    return errorResponse(err)
  }
}
