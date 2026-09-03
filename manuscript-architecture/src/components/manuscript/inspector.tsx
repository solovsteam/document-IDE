'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useManuscript } from '@/lib/store'
import { BAND_STYLE, bandOf, fmtConfidence, REVIEW_THRESHOLD } from '@/lib/confidence'
import { STATUS_META } from './status'
import { cn } from '@/lib/utils'
import {
  BookOpen,
  Check,
  CircleHelp,
  History,
  Lightbulb,
  MessageSquarePlus,
  Pencil,
  ShieldCheck,
  Signal,
  ThumbsDown,
  X,
} from 'lucide-react'
import type { BlockView } from '@/lib/types'

function SectionTitle({ icon: Icon, children }: { icon: typeof Signal; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {children}
    </h3>
  )
}

function Bar({ label, value }: { label: string; value: number | null }) {
  const pct = value === null ? 0 : Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className="flex items-center gap-2">
      <span className="w-5 font-mono text-xs text-stone-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full rounded-full bg-[#227fad]" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right font-mono text-xs text-stone-600">
        {value === null ? '—' : value.toFixed(2)}
      </span>
    </div>
  )
}

function InspectorBody({ block }: { block: BlockView }) {
  const { toast } = useToast()
  const events = useManuscript((s) => s.events)
  const selectBlock = useManuscript((s) => s.selectBlock)

  const [rejecting, setRejecting] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)

  const band = bandOf(block.meta?.confidence)
  const style = BAND_STYLE[band]
  const canFreeze = ['draft', 'in_review', 'revised'].includes(block.status)
  const canReject = canFreeze
  const canEdit = canFreeze

  const history = useMemo(
    () =>
      events
        .filter((e) => {
          const p = e.payload as { blockId?: string; blockNo?: string; cr?: { blockId?: string } }
          return (
            p?.blockId === block.id ||
            p?.blockNo === block.blockNo ||
            p?.cr?.blockId === block.id
          )
        })
        .slice(-14)
        .reverse(),
    [events, block.id, block.blockNo],
  )

  const post = async (url: string, body?: unknown, okMsg?: string) => {
    setBusy(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast({ title: 'Rejected by the gatekeeper', description: data.error, variant: 'destructive' })
        return false
      }
      if (okMsg) toast({ title: okMsg })
      return true
    } catch {
      toast({ title: 'Network error', variant: 'destructive' })
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-4">
      {/* header + actions */}
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded border border-stone-300 bg-white px-1.5 py-0.5 font-mono text-xs font-medium text-stone-600">
            {block.blockNo}
          </span>
          <Badge
            variant="outline"
            className="border-stone-300 text-[10px] uppercase tracking-wide text-stone-600"
          >
            {block.type}
          </Badge>
          <span
            className="text-[10px] font-medium uppercase tracking-wide"
            style={{ color: STATUS_META[block.status].color }}
          >
            {STATUS_META[block.status].label}
          </span>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Button
            size="sm"
            disabled={!canFreeze || busy}
            onClick={async () => {
              const ok = await post(`/api/blocks/${block.id}/approve`, undefined, 'Block frozen')
              if (ok) setRejecting(false)
            }}
            className="h-8 bg-emerald-700 px-2.5 text-xs text-white hover:bg-emerald-800"
          >
            <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden /> Approve &amp; freeze
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={!canReject || busy}
            onClick={() => {
              if (rejecting && instruction.trim()) {
                void post(
                  `/api/blocks/${block.id}/reject`,
                  { instruction },
                  'Change request filed — block reopened',
                ).then((ok) => {
                  if (ok) {
                    setRejecting(false)
                    setInstruction('')
                  }
                })
              } else {
                setRejecting((v) => !v)
                setEditing(false)
              }
            }}
            className="h-8 border-red-300 px-2.5 text-xs text-red-700 hover:bg-red-50"
          >
            {rejecting ? <Check className="mr-1 h-3.5 w-3.5" aria-hidden /> : <ThumbsDown className="mr-1 h-3.5 w-3.5" aria-hidden />}
            {rejecting ? 'File CR' : 'Reject → CR'}
            {rejecting && <X className="ml-1.5 h-3 w-3" aria-hidden onClick={(e) => { e.stopPropagation(); setRejecting(false) }} />}
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={!canEdit || busy}
            onClick={() => {
              if (editing && editText.trim() && editText !== block.content) {
                void post(
                  `/api/blocks/${block.id}/edit`,
                  { content: editText },
                  'Human patch applied — s1 set to 1.0',
                ).then((ok) => {
                  if (ok) setEditing(false)
                })
              } else {
                setEditing((v) => !v)
                setEditText(block.content)
                setRejecting(false)
              }
            }}
            className="h-8 border-stone-300 px-2.5 text-xs text-stone-700 hover:bg-stone-100"
          >
            {editing ? <Check className="mr-1 h-3.5 w-3.5" aria-hidden /> : <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />}
            {editing ? 'Save patch' : 'Edit'}
          </Button>
        </div>

        {rejecting && (
          <div className="mt-2">
            <Textarea
              autoFocus
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="What should change in this block? Filed as an auto-approved change request; the loop re-drafts it at the next boundary."
              className="min-h-16 border-stone-300 text-xs"
            />
            <p className="mt-1 text-[10px] text-stone-400">
              Press &quot;File CR&quot; again to submit. Frozen blocks refuse rejection — use the Board.
            </p>
          </div>
        )}

        {editing && (
          <div className="mt-2">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="min-h-32 border-stone-300 font-serif text-xs leading-relaxed"
            />
            <p className="mt-1 text-[10px] text-stone-400">
              Saving replaces the content and sets s1 = 1.0 (the human takes authorship).
            </p>
          </div>
        )}
      </div>

      <Separator />

      {/* confidence */}
      <section className="space-y-2.5" aria-label="Confidence">
        <SectionTitle icon={Signal}>Confidence</SectionTitle>
        {block.meta ? (
          <>
            <div className="flex items-baseline gap-2.5">
              <span className="font-mono text-4xl font-semibold" style={{ color: style.text }}>
                {fmtConfidence(block.meta.confidence)}
              </span>
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                style={{ color: style.text, borderColor: style.border, backgroundColor: style.bg }}
              >
                {style.label} band
              </span>
            </div>
            <div className="space-y-1.5">
              <Bar label="s1" value={block.meta.s1} />
              <Bar label="s2" value={block.meta.s2} />
              <Bar label="s3" value={block.meta.s3} />
            </div>
            <p className="text-[10px] leading-snug text-stone-400">
              C = s1^0.5 · s2^0.5 while drafting; after a critic pass C&apos; = s1^0.4 · s2^0.3 · s3^0.3.
              Critic review triggers below {REVIEW_THRESHOLD.toFixed(2)}.
            </p>
          </>
        ) : (
          <p className="text-xs text-stone-400">
            No score yet — confidence is written when the drafter completes the block.
          </p>
        )}
      </section>

      <Separator />

      {/* reasoning */}
      <section className="space-y-2" aria-label="Reasoning">
        <SectionTitle icon={Lightbulb}>Reasoning</SectionTitle>
        {block.meta?.rationale ? (
          <p className="text-xs leading-relaxed text-stone-700">{block.meta.rationale}</p>
        ) : (
          <p className="text-xs text-stone-400">No rationale recorded yet.</p>
        )}
        {block.meta?.alternatives?.length ? (
          <ul className="space-y-1.5">
            {block.meta.alternatives.map((alt, i) => (
              <li key={i} className="rounded-md border border-stone-200 bg-stone-50 p-2">
                <p className="text-xs font-medium text-stone-700">{alt.text}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-stone-500">{alt.why}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <Separator />

      {/* sources */}
      <section className="space-y-2" aria-label="Sources">
        <SectionTitle icon={BookOpen}>
          Sources ({block.sources.length})
        </SectionTitle>
        {block.sources.length === 0 ? (
          <p className="text-xs text-stone-400">
            No sources attached. Uncovered claims drag s2 — and the composite — down.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {block.sources.map((src, i) => (
              <li key={i} className="rounded-md border border-stone-200 p-2">
                <p className="text-xs font-medium text-stone-800">{src.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-stone-500">{src.snippet}</p>
                <p className="mt-1 truncate font-mono text-[10px] text-stone-400">{src.uri}</p>
                {src.claimSpan && (
                  <p className="mt-1 border-l-2 pl-1.5 text-[10px] italic leading-snug text-stone-400" style={{ borderColor: style.border }}>
                    covers: “{src.claimSpan}”
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Separator />

      {/* open questions */}
      <section className="space-y-2" aria-label="Open questions">
        <SectionTitle icon={CircleHelp}>
          Open questions ({block.meta?.openQuestions?.length ?? 0})
        </SectionTitle>
        {block.meta?.openQuestions?.length ? (
          <ul className="space-y-1">
            {block.meta.openQuestions.map((q, i) => (
              <li key={i} className="flex gap-1.5 text-xs leading-snug text-stone-600">
                <span className="text-stone-400">·</span>
                {q}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-stone-400">None recorded.</p>
        )}
        <form
          className="flex gap-1.5"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!question.trim()) return
            const ok = await post(
              '/api/messages',
              { body: question, pinnedBlockId: block.id },
              undefined,
            )
            if (ok) setQuestion('')
          }}
        >
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about this block (posts a pinned chat message)…"
            className="h-8 border-stone-300 text-xs"
          />
          <Button
            type="submit"
            size="sm"
            disabled={busy || !question.trim()}
            className="h-8 bg-[#227fad] px-2.5 text-white hover:bg-[#1c6c94]"
            aria-label="Send pinned question"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </form>
      </section>

      <Separator />

      {/* history */}
      <section className="space-y-2" aria-label="Block history">
        <SectionTitle icon={History}>History</SectionTitle>
        {history.length === 0 ? (
          <p className="text-xs text-stone-400">No events for this block yet.</p>
        ) : (
          <ul className="space-y-1">
            {history.map((e) => (
              <li key={e.id} className="flex items-baseline gap-2 font-mono text-[10px] text-stone-500">
                <span className="w-8 shrink-0 text-right text-stone-300">#{e.id}</span>
                <span className={cn('w-32 shrink-0 font-medium text-stone-700')}>{e.type}</span>
                <span className="w-16 shrink-0 text-stone-400">{e.actor}</span>
                <span className="truncate text-stone-400">
                  {new Date(e.createdAt).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export function Inspector() {
  const selectedBlockId = useManuscript((s) => s.selectedBlockId)
  const blocks = useManuscript((s) => s.blocks)
  const selectBlock = useManuscript((s) => s.selectBlock)
  const block = blocks.find((b) => b.id === selectedBlockId) ?? null

  if (!block) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-medium text-stone-500">No block selected</p>
        <p className="max-w-56 text-xs leading-relaxed text-stone-400">
          Click any block in the manuscript to inspect its reasoning, signals, sources, and event history.
        </p>
        {blocks.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-8 border-stone-300 text-xs"
            onClick={() => selectBlock(blocks[0].id)}
          >
            Inspect {blocks[0].blockNo}
          </Button>
        )}
      </div>
    )
  }

  return <InspectorBody key={block.id} block={block} />
}
