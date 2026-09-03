'use client'

import { Download, Pause, Play, RotateCcw, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useManuscript } from '@/lib/store'
import type { OrchState } from '@/lib/types'

const STATE_META: Record<OrchState, { label: string; dot: string; cls: string }> = {
  idle: { label: 'Idle', dot: 'bg-stone-400', cls: 'text-stone-600 border-stone-300' },
  running: { label: 'Running', dot: 'bg-emerald-600 animate-pulse', cls: 'text-emerald-800 border-emerald-300 bg-emerald-50' },
  paused: { label: 'Paused', dot: 'bg-amber-500', cls: 'text-amber-800 border-amber-300 bg-amber-50' },
}

async function sessionAction(action: 'start' | 'pause' | 'reset') {
  try {
    await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (action === 'reset') {
      // snapshot event arrives via SSE; hydrate immediately as a fallback
      await useManuscript.getState().hydrate()
    }
  } catch {
    /* SSE surface errors via system messages */
  }
}

export function TopBar() {
  const orchState = useManuscript((s) => s.orchState)
  const budget = useManuscript((s) => s.budget)
  const title = useManuscript((s) => s.document?.title)
  const connection = useManuscript((s) => s.connection)

  const meta = STATE_META[orchState]
  const pct = budget.total > 0 ? Math.min(100, (budget.used / budget.total) * 100) : 0

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#227fad] text-white">
            <ScrollText className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold leading-tight text-stone-900">
              The Manuscript Architecture
            </h1>
            <p className="truncate text-[11px] leading-tight text-stone-500">
              {title ?? 'loading session…'}
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.cls}`}
            title={`Orchestrator: ${meta.label} — SSE ${connection}`}
          >
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
            {meta.label}
          </span>

          <div className="hidden min-w-44 flex-col gap-1 sm:flex" title="Token budget">
            <div className="flex justify-between text-[10px] uppercase tracking-wide text-stone-400">
              <span>budget</span>
              <span className="font-mono normal-case tracking-normal text-stone-600">
                {budget.used.toLocaleString()} / {budget.total.toLocaleString()}
              </span>
            </div>
            <Progress value={pct} className="h-1.5 bg-stone-200" aria-label="Token budget used" />
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={() => void sessionAction('start')}
              disabled={orchState === 'running'}
              className="h-8 bg-[#227fad] px-3 text-white hover:bg-[#1c6c94]"
            >
              <Play className="mr-1 h-3.5 w-3.5" aria-hidden /> Start
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void sessionAction('pause')}
              disabled={orchState !== 'running'}
              className="h-8 border-stone-300 px-3 text-stone-700 hover:bg-stone-100"
            >
              <Pause className="mr-1 h-3.5 w-3.5" aria-hidden /> Pause
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void sessionAction('reset')}
              className="h-8 border-stone-300 px-3 text-stone-700 hover:bg-stone-100"
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden /> Reset
            </Button>
            <Button
              size="sm"
              variant="ghost"
              asChild
              className="h-8 px-3 text-stone-600 hover:bg-stone-100"
            >
              <a href="/api/export/events" download title="Download the full event log as JSON">
                <Download className="mr-1 h-3.5 w-3.5" aria-hidden /> Log
              </a>
            </Button>
          </div>
        </div>
      </div>
      {connection !== 'open' && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-1 text-center text-[11px] text-amber-800">
          Live stream {connection} — reconnecting with backoff…
        </div>
      )}
    </header>
  )
}
