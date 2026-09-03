'use client'

import { useManuscript } from '@/lib/store'
import { BlockCard } from './block-card'
import { Skeleton } from '@/components/ui/skeleton'

export function DocumentCanvas() {
  const blocks = useManuscript((s) => s.blocks)
  const hydrated = useManuscript((s) => s.hydrated)
  const selectedBlockId = useManuscript((s) => s.selectedBlockId)
  const selectBlock = useManuscript((s) => s.selectBlock)

  if (!hydrated && blocks.length === 0) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading document">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className={`h-20 w-full ${i % 2 ? 'w-11/12' : ''}`} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2.5" aria-label="Manuscript blocks">
      {blocks.map((block) => (
        <BlockCard
          key={block.id}
          block={block}
          selected={block.id === selectedBlockId}
          onSelect={() => selectBlock(block.id)}
        />
      ))}
      {blocks.length === 0 && (
        <p className="py-16 text-center text-sm text-stone-400">
          No document in the store. Press Reset to seed the session.
        </p>
      )}
    </div>
  )
}
