'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { useManuscript } from '@/lib/store'
import { STATUS_BAR_COLORS, STATUS_META } from './status'
import { cn } from '@/lib/utils'
import type { BlockStatus, CRView } from '@/lib/types'
import { CircleDot, GitPullRequestArrow, Inbox, Pause, Play } from 'lucide-react'

const TASK_KIND_LABEL: Record<'draft' | 'critic' | 'revise', string> = {
  draft: 'draft',
  critic: 'critic review',
  revise: 'revision',
}

async function control(action: 'start' | 'pause') {
  await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  }).catch(() => undefined)
}

function CRCard({ cr }: { cr: CRView }) {
  const { toast } = useToast()
  const open = cr.status === 'open'

  const act = async (action: 'approve' | 'discard') => {
    try {
      const res = await fetch(`/api/cr/${cr.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast({ title: 'Change request refused', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' })
    }
  }

  return (
    <li className="rounded-md border border-stone-200 bg-white p-2.5">
      <div className="flex items-center gap-1.5">
        <Badge
          variant="outline"
          className={cn(
            'px-1.5 py-0 text-[9px] uppercase tracking-wide',
            cr.origin === 'critic'
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-[#227fad]/40 bg-[#227fad]/5 text-[#1c6c94]',
          )}
        >
          {cr.origin}
        </Badge>
        <span className="font-mono text-[10px] text-stone-500">{cr.blockNo}</span>
        <span
          className={cn(
            'ml-auto text-[10px] font-medium uppercase tracking-wide',
            cr.status === 'open' && 'text-amber-700',
            cr.status === 'approved' && 'text-[#1c6c94]',
            cr.status === 'applied' && 'text-emerald-700',
            cr.status === 'discarded' && 'text-stone-400',
          )}
        >
          {cr.status}
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-stone-600">
        {cr.instruction}
      </p>
      {open && (
        <div className="mt-2 flex gap-1.5">
          <Button
            size="sm"
            className="h-7 bg-emerald-700 px-2 text-[11px] text-white hover:bg-emerald-800"
            onClick={() => void act('approve')}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-stone-300 px-2 text-[11px] text-stone-600 hover:bg-stone-100"
            onClick={() => void act('discard')}
          >
            Discard
          </Button>
        </div>
      )}
    </li>
  )
}

export function BoardPanel() {
  const orchState = useManuscript((s) => s.orchState)
  const budget = useManuscript((s) => s.budget)
  const tasks = useManuscript((s) => s.tasks)
  const changeRequests = useManuscript((s) => s.changeRequests)
  const blocks = useManuscript((s) => s.blocks)

  const pct = budget.total > 0 ? Math.min(100, (budget.used / budget.total) * 100) : 0
  const openCRs = changeRequests.filter((c) => c.status === 'open')
  const recentCRs = changeRequests.slice(0, 12)

  const statusCounts = blocks.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1
    return acc
  }, {})
  const total = blocks.length || 1

  return (
    <div className="space-y-4 p-4">
      {/* orchestrator */}
      <section className="space-y-2.5" aria-label="Orchestrator">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            Orchestrator
          </h3>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              onClick={() => void control('start')}
              disabled={orchState === 'running'}
              className="h-7 bg-[#227fad] px-2 text-[11px] text-white hover:bg-[#1c6c94]"
            >
              <Play className="mr-1 h-3 w-3" aria-hidden /> Run
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void control('pause')}
              disabled={orchState !== 'running'}
              className="h-7 border-stone-300 px-2 text-[11px] text-stone-600 hover:bg-stone-100"
            >
              <Pause className="mr-1 h-3 w-3" aria-hidden /> Pause
            </Button>
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[10px] text-stone-400">
            <span>token budget</span>
            <span className="font-mono text-stone-600">
              {budget.used.toLocaleString()} / {budget.total.toLocaleString()}
            </span>
          </div>
          <Progress value={pct} className="h-1.5 bg-stone-200" aria-label="Token budget" />
        </div>
      </section>

      <Separator />

      {/* tasks */}
      <section className="space-y-2" aria-label="Task list">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          <CircleDot className="h-3.5 w-3.5" aria-hidden /> Tasks ({tasks.filter((t) => t.status === 'running').length} running)
        </h3>
        {tasks.length === 0 ? (
          <p className="text-xs text-stone-400">No tasks yet — press Start.</p>
        ) : (
          <ul className="max-h-40 space-y-1 overflow-y-auto pr-1">
            {[...tasks].reverse().map((t) => (
              <li
                key={t.taskId}
                className="flex items-center gap-2 rounded-md border border-stone-100 bg-stone-50 px-2 py-1"
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    t.status === 'running' ? 'animate-pulse bg-amber-500' : 'bg-stone-300',
                  )}
                  aria-hidden
                />
                <span className="font-mono text-[10px] text-stone-400">{t.taskId}</span>
                <span className="text-[11px] text-stone-600">{TASK_KIND_LABEL[t.kind]}</span>
                <span className="font-mono text-[10px] text-stone-500">{t.blockNo}</span>
                <span
                  className={cn(
                    'ml-auto text-[9px] font-medium uppercase tracking-wide',
                    t.status === 'running' ? 'text-amber-700' : 'text-stone-400',
                  )}
                >
                  {t.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Separator />

      {/* CR queue */}
      <section className="space-y-2" aria-label="Change request queue">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          <GitPullRequestArrow className="h-3.5 w-3.5" aria-hidden /> Change requests ({openCRs.length} open)
        </h3>
        {recentCRs.length === 0 ? (
          <p className="text-xs text-stone-400">
            Queue empty. Critic passes and pinned chat messages file CRs here.
          </p>
        ) : (
          <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {recentCRs.map((cr) => (
              <CRCard key={cr.id} cr={cr} />
            ))}
          </ul>
        )}
      </section>

      <Separator />

      {/* status distribution */}
      <section className="space-y-2" aria-label="Block status distribution">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          <Inbox className="h-3.5 w-3.5" aria-hidden /> Blocks by status
        </h3>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
          {(['placeholder', 'drafting', 'draft', 'in_review', 'revised', 'frozen'] as BlockStatus[]).map(
            (st) => {
              const n = statusCounts[st] ?? 0
              if (!n) return null
              return (
                <div
                  key={st}
                  style={{ width: `${(n / total) * 100}%`, backgroundColor: STATUS_BAR_COLORS[st] }}
                  title={`${STATUS_META[st].label}: ${n}`}
                />
              )
            },
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {(['placeholder', 'drafting', 'draft', 'in_review', 'revised', 'frozen'] as BlockStatus[]).map(
            (st) => (
              <span key={st} className="flex items-center gap-1 text-[10px] text-stone-500">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: STATUS_BAR_COLORS[st] }}
                  aria-hidden
                />
                {STATUS_META[st].label} · {statusCounts[st] ?? 0}
              </span>
            ),
          )}
        </div>
      </section>
    </div>
  )
}
