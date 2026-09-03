// Client state: hydrates from /api/state, then reduces SSE events.
// Every event type from the server is handled here.

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  BlockPatchedPayload,
  BlockView,
  BudgetUpdatedPayload,
  ConfidenceUpdatedPayload,
  CRFiledPayload,
  CRResolvedPayload,
  CRView,
  EventView,
  FoldState,
  MessagePostedPayload,
  MessageView,
  OrchState,
  OrchStateChangedPayload,
  StatusChangedPayload,
  TaskPayload,
} from './types'

export type PanelTab = 'inspector' | 'chat' | 'board'

export interface UITask {
  taskId: string
  kind: 'draft' | 'critic' | 'revise'
  blockId: string
  blockNo: string
  status: 'running' | 'done'
}

interface ManuscriptState {
  hydrated: boolean
  connection: 'connecting' | 'open' | 'reconnecting'
  document: { id: string; title: string } | null
  blocks: BlockView[]
  changeRequests: CRView[]
  messages: MessageView[]
  events: EventView[]
  tasks: UITask[]
  budget: { used: number; total: number }
  orchState: 'idle' | 'running' | 'paused'
  selectedBlockId: string | null
  activeTab: PanelTab
  lastEventId: number

  hydrate: () => Promise<void>
  applyEvent: (e: EventView) => void
  setConnection: (c: ManuscriptState['connection']) => void
  setOrchState: (state: OrchState, budget?: { used: number; total: number }) => void
  selectBlock: (blockId: string | null) => void
  setTab: (tab: PanelTab) => void
}

function tasksFromEvents(events: EventView[]): UITask[] {
  const tasks: UITask[] = []
  for (const e of events) {
    if (e.type === 'TaskSpawned') {
      const p = e.payload as unknown as TaskPayload
      if (!p?.taskId) continue
      tasks.push({
        taskId: p.taskId,
        kind: p.kind,
        blockId: p.blockId,
        blockNo: p.blockNo ?? '?',
        status: 'running',
      })
    } else if (e.type === 'TaskFinished') {
      const p = e.payload as unknown as TaskPayload
      const t = tasks.find((x) => x.taskId === p?.taskId)
      if (t) t.status = 'done'
    }
  }
  return tasks.slice(-60)
}

function applyFold(draft: ManuscriptState, fold: FoldState): void {
  draft.document = fold.document
  draft.blocks = fold.blocks
  draft.changeRequests = fold.changeRequests
  draft.messages = fold.messages
  draft.events = fold.events
  draft.tasks = tasksFromEvents(fold.events)
  draft.budget = fold.budget
  draft.orchState = fold.orchestratorState
  draft.lastEventId = Math.max(draft.lastEventId, fold.cursor)
  // keep selection if the block still exists
  if (draft.selectedBlockId && !fold.blocks.some((b) => b.id === draft.selectedBlockId)) {
    draft.selectedBlockId = null
  }
}

export const useManuscript = create<ManuscriptState>()(
  immer<ManuscriptState>((set, get) => ({
  hydrated: false,
  connection: 'connecting',
  document: null,
  blocks: [],
  changeRequests: [],
  messages: [],
  events: [],
  tasks: [],
  budget: { used: 0, total: 10000 },
  orchState: 'idle',
  selectedBlockId: null,
  activeTab: 'inspector',
  lastEventId: 0,

  hydrate: async () => {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' })
      if (!res.ok) return
      const fold = (await res.json()) as FoldState
      set((draft) => {
        applyFold(draft, fold)
        draft.hydrated = true
      })
    } catch {
      /* offline; SSE reconnect will retry */
    }
  },

  setConnection: (connection) => set({ connection }),

  setOrchState: (state, budget) =>
    set((draft) => {
      draft.orchState = state
      if (budget) draft.budget = budget
    }),

  selectBlock: (blockId) =>
    set({ selectedBlockId: blockId, activeTab: blockId ? 'inspector' : get().activeTab }),

  setTab: (activeTab) => set({ activeTab }),

  applyEvent: (e) => {
    if (e.type === 'hello') return

    // SessionReset always wins and carries a full snapshot.
    if (e.type === 'SessionReset') {
      const p = e.payload as unknown as { snapshot?: FoldState }
      set((draft) => {
        draft.lastEventId = e.id
        if (p.snapshot) {
          applyFold(draft, p.snapshot)
        } else {
          void get().hydrate()
        }
        draft.hydrated = true
      })
      return
    }

    const state = get()
    if (e.id <= state.lastEventId) return // dedupe replays

    set((draft) => {
      draft.lastEventId = e.id
      draft.events = [...draft.events, e].slice(-300)

      switch (e.type) {
        case 'BlockPatched': {
          const p = e.payload as unknown as BlockPatchedPayload
          draft.blocks = draft.blocks.map((b) => {
            if (b.id !== p.blockId) return b
            const content = p.mode === 'replace' ? p.delta : b.content + p.delta
            return { ...b, content }
          })
          break
        }
        case 'StatusChanged': {
          const p = e.payload as unknown as StatusChangedPayload
          draft.blocks = draft.blocks.map((b) =>
            b.id === p.blockId ? { ...b, status: p.to } : b,
          )
          break
        }
        case 'ConfidenceUpdated': {
          const p = e.payload as unknown as ConfidenceUpdatedPayload
          draft.blocks = draft.blocks.map((b) =>
            b.id === p.blockId ? { ...b, meta: p.meta } : b,
          )
          break
        }
        case 'MessagePosted': {
          const p = e.payload as unknown as MessagePostedPayload
          if (p.message && !draft.messages.some((m) => m.id === p.message.id)) {
            draft.messages = [...draft.messages, p.message].slice(-200)
          }
          break
        }
        case 'CRFiled': {
          const p = e.payload as unknown as CRFiledPayload
          if (p.cr && !draft.changeRequests.some((c) => c.id === p.cr.id)) {
            draft.changeRequests = [p.cr, ...draft.changeRequests]
          }
          break
        }
        case 'CRResolved': {
          const p = e.payload as unknown as CRResolvedPayload
          draft.changeRequests = draft.changeRequests.map((c) =>
            c.id === p.crId ? { ...c, status: p.status } : c,
          )
          // a revision just completed — pull fresh sources/meta for the block
          if (p.status === 'applied') {
            void get().hydrate()
          }
          break
        }
        case 'TaskSpawned': {
          const p = e.payload as unknown as TaskPayload
          if (p.taskId && !draft.tasks.some((t) => t.taskId === p.taskId)) {
            draft.tasks = [
              ...draft.tasks,
              {
                taskId: p.taskId,
                kind: p.kind,
                blockId: p.blockId,
                blockNo: p.blockNo ?? '?',
                status: 'running' as const,
              },
            ].slice(-60)
          }
          break
        }
        case 'TaskFinished': {
          const p = e.payload as unknown as TaskPayload
          draft.tasks = draft.tasks.map((t) =>
            t.taskId === p.taskId ? { ...t, status: 'done' as const } : t,
          )
          break
        }
        case 'BudgetUpdated': {
          const p = e.payload as unknown as BudgetUpdatedPayload
          draft.budget = { used: p.used, total: p.total }
          break
        }
        case 'OrchStateChanged': {
          const p = e.payload as unknown as OrchStateChangedPayload
          if (p?.state) draft.orchState = p.state
          break
        }
        default:
          break
      }
    })
  },
  }),
))
