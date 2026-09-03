// The Orchestrator: a singleton event loop that drives the scripted session.
// Cached on globalThis so the interval survives Next.js HMR.

import { db } from '@/lib/db'
import { composite, compositeCritic, REVIEW_THRESHOLD, CRITIC_CR_THRESHOLD } from '@/lib/confidence'
import { chunkContent, SESSION_SCRIPT, type BlockScript } from './mock-adapter'
import { runtime, nextTaskId, type OrchTask } from './runtime'
import {
  appendEvent,
  postSystemMessage,
} from './events'
import {
  applyPatch,
  fileCR,
  linkSource,
  requestTransition,
  resolveCR,
  writeMeta,
} from './gatekeeper'
import { blockNoOf } from '@/lib/types'

async function getDocumentId(): Promise<string | null> {
  if (runtime.documentId) {
    const exists = await db.document.findUnique({
      where: { id: runtime.documentId },
      select: { id: true },
    })
    if (exists) return exists.id
    runtime.documentId = null
  }
  const doc = await db.document.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  runtime.documentId = doc?.id ?? null
  return runtime.documentId
}

function scriptFor(orderIdx: number): BlockScript | null {
  return SESSION_SCRIPT[orderIdx] ?? null
}

function tokensFor(chunk: string): number {
  const words = chunk.trim().split(/\s+/).filter(Boolean).length
  return Math.max(12, words * 6)
}

async function spendBudget(tokens: number): Promise<void> {
  runtime.budgetUsed += tokens
  await appendEvent('BudgetUpdated', 'system', {
    used: runtime.budgetUsed,
    total: runtime.budgetTotal,
  })
}

async function pauseForBudgetExhaustion(): Promise<void> {
  pause()
  await postSystemMessage(
    `Token budget exhausted (${runtime.budgetUsed} of ${runtime.budgetTotal} tokens). The orchestrator paused itself — reset the session to run again.`,
  )
}

async function startDraftTask(blockId: string, orderIdx: number): Promise<void> {
  const script = scriptFor(orderIdx)
  if (!script) return
  const blockNo = blockNoOf(orderIdx)
  await requestTransition(blockId, 'drafting', 'planner')
  const taskId = nextTaskId()
  await appendEvent('TaskSpawned', 'planner', {
    taskId,
    kind: 'draft',
    blockId,
    blockNo,
  })
  runtime.currentTask = {
    kind: 'draft',
    taskId,
    blockId,
    blockNo,
    script,
    chunks: chunkContent(script.content, script.chunkCount),
    chunkIdx: 0,
  }
}

async function startReviseTask(
  blockId: string,
  crId: string | null,
): Promise<void> {
  const block = await db.block.findUnique({ where: { id: blockId } })
  if (!block) return
  const script = scriptFor(block.orderIdx)
  if (!script) return
  const blockNo = blockNoOf(block.orderIdx)
  // Reopen (backwards) is legal here: the CR that led here is approved.
  if (block.status !== 'drafting') {
    await requestTransition(blockId, 'drafting', 'planner', {
      approvedCR: crId ?? undefined,
    })
  }
  const taskId = nextTaskId()
  await appendEvent('TaskSpawned', 'planner', {
    taskId,
    kind: 'revise',
    blockId,
    blockNo,
    crId,
  })
  runtime.currentTask = {
    kind: 'revise',
    taskId,
    blockId,
    blockNo,
    crId,
    script,
    chunks: chunkContent(script.revision.content, script.revision.chunkCount),
    chunkIdx: 0,
  }
}

async function completeDraftTask(task: Extract<OrchTask, { kind: 'draft' }>) {
  const { blockId, blockNo, script, taskId } = task
  await requestTransition(blockId, 'draft', 'drafter')
  const c = composite(script.s1, script.s2)
  await writeMeta(
    blockId,
    {
      confidence: Math.round(c * 1000) / 1000,
      s1: script.s1,
      s2: script.s2,
      s3: null,
      rationale: script.rationale,
      alternatives: script.alternatives,
      openQuestions: script.openQuestions,
    },
    'drafter',
  )
  await requestTransition(blockId, 'in_review', 'drafter')
  await appendEvent('TaskFinished', 'drafter', { taskId, kind: 'draft', blockId, blockNo })
  runtime.currentTask = null

  if (c < REVIEW_THRESHOLD) {
    const criticTaskId = nextTaskId()
    await appendEvent('TaskSpawned', 'critic', {
      taskId: criticTaskId,
      kind: 'critic',
      blockId,
      blockNo,
      reason: `composite ${c.toFixed(2)} < ${REVIEW_THRESHOLD}`,
    })
    runtime.currentTask = { kind: 'critic', taskId: criticTaskId, blockId, blockNo, script }
  }
}

async function runCriticTask(task: Extract<OrchTask, { kind: 'critic' }>) {
  const { blockId, blockNo, script, taskId } = task
  const s3 = script.criticS3
  const c2 = compositeCritic(script.s1, script.s2, s3)
  await writeMeta(
    blockId,
    { s3, confidence: Math.round(c2 * 1000) / 1000 },
    'critic',
  )
  if (c2 < CRITIC_CR_THRESHOLD) {
    await fileCR(blockId, 'critic', script.criticInstruction, 'open')
  }
  await appendEvent('TaskFinished', 'critic', { taskId, kind: 'critic', blockId, blockNo })
  runtime.currentTask = null
}

async function completeReviseTask(task: Extract<OrchTask, { kind: 'revise' }>) {
  const { blockId, blockNo, script, taskId, crId } = task
  const rev = script.revision
  await requestTransition(blockId, 'draft', 'drafter')
  if (rev.addSource) {
    await linkSource(blockId, rev.addSource)
  }
  const s2 = rev.s2 ?? script.s2
  const c2 = compositeCritic(rev.s1, s2, rev.s3)
  await writeMeta(
    blockId,
    {
      confidence: Math.round(c2 * 1000) / 1000,
      s1: rev.s1,
      s2,
      s3: rev.s3,
      rationale: rev.rationale,
    },
    'drafter',
  )
  await requestTransition(blockId, 'in_review', 'drafter')
  if (crId) {
    await resolveCR(crId, 'applied')
  }
  await requestTransition(blockId, 'revised', 'critic')
  await appendEvent('TaskFinished', 'critic', { taskId, kind: 'revise', blockId, blockNo })
  runtime.currentTask = null
}

async function pickNextWork(): Promise<boolean> {
  const docId = await getDocumentId()
  if (!docId) return false

  // 1. Queued revisions (from approved CRs / pinned chat messages) first.
  const queued = runtime.revisionQueue.shift()
  if (queued) {
    await startReviseTask(queued.blockId, queued.crId)
    return true
  }

  // 2. Next placeholder block in document order.
  const next = await db.block.findFirst({
    where: { documentId: docId, status: 'placeholder' },
    orderBy: { orderIdx: 'asc' },
  })
  if (next) {
    await startDraftTask(next.id, next.orderIdx)
    return true
  }

  // 3. Nothing left — the loop goes idle.
  pause()
  runtime.state = 'idle'
  await postSystemMessage(
    'All placeholder blocks are drafted. The loop is idle — approve a block to freeze it, or pin a chat message to reopen one.',
  )
  return false
}

async function tick(): Promise<void> {
  if (runtime.state !== 'running' || runtime.ticking) return
  runtime.ticking = true
  try {
    if (runtime.budgetUsed >= runtime.budgetTotal) {
      await pauseForBudgetExhaustion()
      return
    }

    if (!runtime.currentTask) {
      const started = await pickNextWork()
      if (!started || !runtime.currentTask) return
    }

    const task = runtime.currentTask
    if (!task) return

    if (task.kind === 'critic') {
      await runCriticTask(task)
    } else {
      const chunk = task.chunks[task.chunkIdx]
      if (chunk !== undefined) {
        // a revision rewrites the block: its first chunk REPLACES the old content
        const firstRevisionChunk = task.kind === 'revise' && task.chunkIdx === 0
        await applyPatch(task.blockId, chunk, 'drafter', {
          replace: firstRevisionChunk,
        })
        await spendBudget(tokensFor(chunk))
        task.chunkIdx += 1
      }
      if (task.chunkIdx >= task.chunks.length) {
        if (task.kind === 'draft') {
          await completeDraftTask(task)
        } else {
          await completeReviseTask(task)
        }
      }
    }
  } catch (err) {
    console.error('[orchestrator] tick failed:', err)
    runtime.currentTask = null
    try {
      await postSystemMessage(
        `Orchestrator tick failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    } catch {
      /* ignore */
    }
  } finally {
    runtime.ticking = false
  }
}

export function start(): void {
  if (runtime.state === 'running' || runtime.timer) return
  runtime.state = 'running'
  runtime.timer = setInterval(() => {
    void tick()
  }, 700)
  void tick()
}

export function pause(): void {
  if (runtime.timer) {
    clearInterval(runtime.timer)
    runtime.timer = null
  }
  if (runtime.state === 'running') runtime.state = 'paused'
}

export function markIdle(): void {
  pause()
  runtime.state = 'idle'
}

export function queueRevision(blockId: string, crId: string | null): void {
  runtime.revisionQueue.push({ blockId, crId })
}

export function resetRuntime(): void {
  pause()
  runtime.state = 'idle'
  runtime.budgetUsed = 0
  runtime.budgetTotal = 10000
  runtime.taskSeq = 0
  runtime.currentTask = null
  runtime.revisionQueue = []
  runtime.documentId = null
  runtime.ticking = false
}

export function getOrchestratorState() {
  return {
    state: runtime.state,
    budget: { used: runtime.budgetUsed, total: runtime.budgetTotal },
    queuedRevisions: runtime.revisionQueue.length,
  }
}
