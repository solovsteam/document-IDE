import { NextResponse } from 'next/server'
import { postUserMessage } from '@/lib/server/session'
import { ensureSeed } from '@/lib/server/seed'
import { errorResponse } from '@/lib/server/http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    await ensureSeed()
    const body = (await req.json().catch(() => ({}))) as {
      body?: string
      pinnedBlockId?: string | null
    }
    await postUserMessage(body.body ?? '', body.pinnedBlockId ?? null)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
