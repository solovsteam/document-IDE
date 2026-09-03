'use client'

import { memo } from 'react'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { BAND_STYLE, bandOf, fmtConfidence } from '@/lib/confidence'
import { STATUS_META } from './status'
import { cn } from '@/lib/utils'
import type { BlockView } from '@/lib/types'
import { Lock } from 'lucide-react'

function SignalBar({ label, value }: { label: string; value: number | null }) {
  const pct = value === null ? 0 : Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className="flex items-center gap-2">
      <span className="w-4 font-mono text-[10px] text-stone-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
        <div
          className="h-full rounded-full bg-[#227fad]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right font-mono text-[10px] text-stone-600">
        {value === null ? '—' : value.toFixed(2)}
      </span>
    </div>
  )
}

function BlockCardInner({
  block,
  selected,
  onSelect,
}: {
  block: BlockView
  selected: boolean
  onSelect: () => void
}) {
  const band = bandOf(block.meta?.confidence)
  const style = BAND_STYLE[band]
  const statusMeta = STATUS_META[block.status]
  const StatusIcon = statusMeta.icon
  const frozen = block.status === 'frozen'
  const isHeading = block.type === 'heading'

  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        <article
          onClick={onSelect}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSelect()
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`${block.blockNo} — ${statusMeta.label} — confidence ${fmtConfidence(block.meta?.confidence)}`}
          className={cn(
            'group relative flex cursor-pointer rounded-lg border border-stone-200/80 transition-all duration-150 hover:border-stone-300 hover:shadow-sm',
            selected && 'ring-2 ring-[#227fad] ring-offset-1',
            frozen && 'opacity-80',
          )}
          style={{ backgroundColor: style.bg }}
        >
          {/* confidence gutter */}
          <span
            aria-hidden
            className="absolute inset-y-1.5 left-0 w-[5px] rounded-full"
            style={{ backgroundColor: style.border }}
          />

          <div className="flex-1 py-3 pl-5 pr-3.5">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded border border-stone-300/70 bg-white/70 px-1.5 py-0.5 font-mono text-[10px] font-medium text-stone-500">
                {block.blockNo}
              </span>
              <span
                className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide"
                style={{ color: statusMeta.color }}
              >
                <StatusIcon
                  className={cn('h-3 w-3', statusMeta.spin && 'animate-spin')}
                  aria-hidden
                />
                {statusMeta.label}
              </span>
              <span className={cn('ml-auto font-mono text-[11px] text-stone-500', frozen && 'mr-5')}>
                {fmtConfidence(block.meta?.confidence)}
              </span>
            </div>

            {isHeading ? (
              <h2 className="text-lg font-semibold leading-snug text-stone-900">
                {block.content || (
                  <span className="text-stone-400">— waiting to be drafted —</span>
                )}
                {block.status === 'drafting' && <Caret />}
              </h2>
            ) : (
              <p className="text-[15px] leading-relaxed text-stone-800">
                {block.content || (
                  <span className="text-stone-400">— waiting to be drafted —</span>
                )}
                {block.status === 'drafting' && <Caret />}
              </p>
            )}
          </div>

          {frozen && (
            <span className="absolute right-2.5 top-2.5 text-stone-500" title="frozen — file a change request to edit">
              <Lock className="h-3.5 w-3.5" aria-hidden />
            </span>
          )}
        </article>
      </HoverCardTrigger>

      {/* popover hidden for the selected block (inspector already shows it),
          and pointer-transparent so it can never intercept inspector clicks */}
      {!selected && (
        <HoverCardContent
          side="left"
          align="start"
          className="pointer-events-none w-72 border-stone-200 p-3.5"
        >
        {block.meta ? (
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between">
              <span
                className="text-2xl font-semibold font-mono"
                style={{ color: style.text }}
              >
                {fmtConfidence(block.meta.confidence)}
              </span>
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                style={{ color: style.text, borderColor: style.border }}
              >
                {style.label}
              </span>
            </div>
            <div className="space-y-1.5">
              <SignalBar label="s1" value={block.meta.s1} />
              <SignalBar label="s2" value={block.meta.s2} />
              <SignalBar label="s3" value={block.meta.s3} />
            </div>
            {block.meta.rationale && (
              <p className="line-clamp-2 text-xs leading-snug text-stone-600">
                {block.meta.rationale}
              </p>
            )}
            <div className="flex items-center justify-between text-[11px] text-stone-500">
              <span>
                {block.sources.length} source{block.sources.length === 1 ? '' : 's'}
              </span>
              {frozen ? (
                <span className="font-medium text-stone-600">
                  frozen — file a change request to edit
                </span>
              ) : (
                <span className="font-medium text-[#227fad]">click to inspect</span>
              )}
            </div>
          </div>
        ) : (
          <div className="py-1 text-center">
            <p className="text-sm font-medium text-stone-600">Not yet scored</p>
            <p className="mt-1 text-xs text-stone-400">
              Confidence appears once the drafter finishes this block.
            </p>
          </div>
        )}
        </HoverCardContent>
      )}
    </HoverCard>
  )
}

function Caret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-stone-700"
    />
  )
}

export const BlockCard = memo(BlockCardInner)
