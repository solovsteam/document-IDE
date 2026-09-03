import { NextResponse } from 'next/server'
import { applyHumanEdit } from '@/lib/server/session'
import { errorResponse } from '@/lib/server/http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params
    const body = (await req.json().catch(() => ({}))) as { content?: string }
    await applyHumanEdit(id, body.content ?? '')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
