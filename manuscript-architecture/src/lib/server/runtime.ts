// Volatile orchestrator runtime state, cached on globalThis to survive HMR.
// No imports of DB-touching modules here (keeps the dependency graph acyclic).

import type { OrchState } from '@/lib/types'

export type OrchTask =
  | {
      kind: 'draft'
      taskId: string
      blockId: string
      blockNo: string
      script: import('./mock-adapter').BlockScript
      chunks: string[]
      chunkIdx: number
    }
  | {
      kind: 'critic'
      taskId: string
      blockId: string
      blockNo: string
      script: import('./mock-adapter').BlockScript
    }
  | {
      kind: 'revise'
      taskId: string
      blockId: string
      blockNo: string
      crId: string | null
      script: import('./mock-adapter').BlockScript
      chunks: string[]
      chunkIdx: number
    }

export interface OrchRuntime {
  state: OrchState
  budgetUsed: number
  budgetTotal: number
  taskSeq: number
  currentTask: OrchTask | null
  revisionQueue: { blockId: string; crId: string | null }[]
  documentId: string | null
  timer: ReturnType<typeof setInterval> | null
  ticking: boolean
}

const globalForOrch = globalThis as unknown as {
  __manuscriptRuntime?: OrchRuntime
}

export const runtime: OrchRuntime =
  globalForOrch.__manuscriptRuntime ??
  (globalForOrch.__manuscriptRuntime = {
    state: 'idle',
    budgetUsed: 0,
    budgetTotal: 10000,
    taskSeq: 0,
    currentTask: null,
    revisionQueue: [],
    documentId: null,
    timer: null,
    ticking: false,
  })

export function nextTaskId(): string {
  runtime.taskSeq += 1
  return `t_${String(runtime.taskSeq).padStart(3, '0')}`
}
