'use client'

import { useManuscript } from '@/lib/store'
import { useManuscriptStream } from '@/hooks/use-manuscript-stream'
import { TopBar } from '@/components/manuscript/top-bar'
import { DocumentCanvas } from '@/components/manuscript/document-canvas'
import { RightPanel } from '@/components/manuscript/right-panel'

export default function Page() {
  useManuscriptStream()

  const document = useManuscript((s) => s.document)
  const blocks = useManuscript((s) => s.blocks)
  const drafted = blocks.filter((b) => b.status !== 'placeholder').length
  const frozen = blocks.filter((b) => b.status === 'frozen').length

  return (
    <div className="flex min-h-screen flex-col bg-stone-100/60">
      <TopBar />

      <main className="mx-auto w-full max-w-[1500px] flex-1 px-3 py-4 sm:px-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* manuscript canvas */}
          <section
            aria-label="Document canvas"
            className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto"
          >
            <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-stone-100 pb-3">
              <h1 className="font-serif text-xl font-semibold text-stone-900 sm:text-2xl">
                {document?.title ?? '…'}
              </h1>
              <p className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-stone-400">
                {drafted}/{blocks.length} drafted · {frozen} frozen
              </p>
            </div>
            <DocumentCanvas />
          </section>

          {/* right panel */}
          <section
            aria-label="Review panel"
            className="min-h-[32rem] lg:h-[calc(100vh-11rem)] lg:min-h-0"
          >
            <RightPanel />
          </section>
        </div>
      </main>

      <footer className="mt-auto border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-2 text-[11px] text-stone-400 sm:px-6">
          <span>
            Event-sourced document IR · gatekeeper-enforced lifecycle · SSE live loop
          </span>
          <span className="font-mono">
            b_001…{String(Math.max(blocks.length, 0)).padStart(3, '0')} · confidence bands: high
            ≥ 0.80 · medium ≥ 0.60 · low ≥ 0.40
          </span>
        </div>
      </footer>
    </div>
  )
}
