import { NextResponse } from 'next/server'
import { foldState } from '@/lib/server/events'
import { ensureSeed } from '@/lib/server/seed'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    await ensureSeed()
    const state = await foldState()
    return NextResponse.json(state)
  } catch (err) {
    console.error('[api/state] failed:', err)
    return NextResponse.json({ error: 'Failed to fold state' }, { status: 500 })
  }
}
