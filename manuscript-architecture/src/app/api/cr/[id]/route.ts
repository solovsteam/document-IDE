import { NextResponse } from 'next/server'
import { approveCR, discardCR } from '@/lib/server/session'
import { errorResponse } from '@/lib/server/http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params
    const body = (await req.json().catch(() => ({}))) as { action?: string }
    if (body.action === 'approve') {
      await approveCR(id)
    } else if (body.action === 'discard') {
      await discardCR(id)
    } else {
      return NextResponse.json(
        { error: `Unknown action: ${String(body.action)}` },
        { status: 400 },
      )
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
