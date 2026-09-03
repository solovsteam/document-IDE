import { NextResponse } from 'next/server'
import { rejectBlock } from '@/lib/server/session'
import { errorResponse } from '@/lib/server/http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params
    const body = (await req.json().catch(() => ({}))) as { instruction?: string }
    const result = await rejectBlock(id, body.instruction ?? '')
    return NextResponse.json({ ok: true, crId: result.crId })
  } catch (err) {
    return errorResponse(err)
  }
}
