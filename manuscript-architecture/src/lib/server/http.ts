import { NextResponse } from 'next/server'
import { GatekeeperError } from './gatekeeper'

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof GatekeeperError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  console.error('[api] unexpected error:', err)
  const message = err instanceof Error ? err.message : 'Internal error'
  return NextResponse.json({ error: message }, { status: 500 })
}
