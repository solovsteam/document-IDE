// User-facing session operations: freeze/reject/edit blocks, post chat
// messages, resolve change requests. Thin orchestration over the gatekeeper.

import { db } from '@/lib/db'
import { composite, compositeCritic } from '@/lib/confidence'
import type { BlockStatus } from '@/lib/types'
import { blockNoOf } from '@/lib/types'
import { appendEvent, postSystemMessage, postMessageRow } from './events'
import {
  applyPatch,
  fileCR,
  GatekeeperError,
  requestTransition,
  resolveCR,
  writeMeta,
} from './gatekeeper'
import { queueRevision, start } from './orchestrator'

async function getBlock(blockId: string) {
  const block = await db.block.findUnique({ where: { id: blockId } })
  if (!block) throw new GatekeeperError(`Block ${blockId} not found`, 404)
  return block
}

/** Human approves a reviewed block → frozen. */
export async function freezeBlock(blockId: string): Promise<void> {
  const block = await getBlock(blockId)
  const from = block.status as BlockStatus
  if (!['draft', 'in_review', 'revised'].includes(from)) {
    throw new GatekeeperError(
      `Cannot freeze ${blockNoOf(block.orderIdx)} from status "${from}". Wait for the draft to reach review.`,
    )
  }
  await requestTransition(blockId, 'frozen', 'human')
  await postSystemMessage(
    `${blockNoOf(block.orderIdx)} frozen by human approval. The loop will not touch it again without an approved change request.`,
  )
}

/** Human rejects a reviewed block with an instruction → CR + reopen. */
export async function rejectBlock(
  blockId: string,
  instruction: string,
): Promise<{ crId: string }> {
  const block = await getBlock(blockId)
  const status = block.status as BlockStatus
  const blockNo = blockNoOf(block.orderIdx)
  if (status === 'frozen') {
    await postSystemMessage(
      `${blockNo} is frozen. Rejection refused — approve a change request from the Board instead.`,
    )
    throw new GatekeeperError(
      `${blockNo} is frozen — file or approve a change request from the Board instead.`,
    )
  }
  if (!['draft', 'in_review', 'revised'].includes(status)) {
    throw new GatekeeperError(
      `Cannot reject ${blockNo} from status "${status}".`,
    )
  }
  const trimmed = instruction.trim()
  if (!trimmed) {
    throw new GatekeeperError('A rejection needs an instruction.')
  }
  const cr = await fileCR(blockId, 'human', trimmed, 'approved')
  await requestTransition(blockId, 'drafting', 'human', {
    approvedCR: cr.id,
  })
  queueRevision(blockId, cr.id)
  start() // wake the loop if it went idle — a human decision must not wait on anything
  await postSystemMessage(
    `Filed CR ${cr.id.slice(-4).toUpperCase()} against ${blockNo}; block returned to drafting with a scripted revision queued at the next boundary.`,
  )
  return { crId: cr.id }
}

/** Human inline patch: replace content, s1 := 1.0, recompute composite. */
export async function applyHumanEdit(
  blockId: string,
  content: string,
): Promise<void> {
  const block = await getBlock(blockId)
  const blockNo = blockNoOf(block.orderIdx)
  if (block.status === 'frozen') {
    throw new GatekeeperError(`${blockNo} is frozen — file a change request to edit it.`)
  }
  if (block.status === 'drafting') {
    throw new GatekeeperError(`${blockNo} is being drafted right now — wait for the boundary.`)
  }
  if (block.status === 'placeholder') {
    throw new GatekeeperError(`${blockNo} has no draft yet — nothing to edit.`)
  }
  if (!content.trim()) {
    throw new GatekeeperError('Empty patch refused.')
  }
  await applyPatch(blockId, content, 'human', { replace: true })
  const existing = await db.blockMeta.findUnique({ where: { blockId } })
  const s1 = 1
  const s2 = existing?.s2 ?? 1
  const s3 = existing?.s3 ?? null
  const conf =
    s3 !== null
      ? compositeCritic(s1, s2, s3)
      : composite(s1, s2)
  await writeMeta(
    blockId,
    {
      s1,
      s2,
      s3,
      confidence: Math.round(conf * 1000) / 1000,
      rationale:
        existing?.rationale ??
        'Human-authored inline patch; the human takes authorship of this block.',
    },
    'human',
  )
  await appendEvent('BlockPatched', 'human', {
    blockId,
    blockNo,
    note: 'human inline patch applied; s1 set to 1.0',
  })
}

/** Chat: post a message; pinning drives the continuous-review machinery. */
export async function postUserMessage(
  body: string,
  pinnedBlockId: string | null,
): Promise<void> {
  const trimmed = body.trim()
  if (!trimmed) throw new GatekeeperError('Message is empty.')

  await postMessageRow('human', trimmed, pinnedBlockId, 'human')

  if (!pinnedBlockId) {
    await postMessageRow(
      'agent',
      'Logged to the session transcript. Unpinned feedback does not trigger revisions — pin a message to a block to convert it into a targeted change request.',
      null,
      'drafter',
    )
    return
  }

  const block = await getBlock(pinnedBlockId)
  const blockNo = blockNoOf(block.orderIdx)
  const status = block.status as BlockStatus

  if (status === 'placeholder' || status === 'drafting') {
    await postMessageRow(
      'system',
      `${blockNo} has no reviewable draft yet (status: ${status}). Your message is pinned and will surface in the inspector history when drafting completes.`,
      pinnedBlockId,
      'system',
    )
    return
  }

  if (status === 'frozen') {
    const cr = await fileCR(
      pinnedBlockId,
      'human',
      `Chat: "${trimmed.slice(0, 160)}"`,
      'open',
    )
    await postMessageRow(
      'system',
      `${blockNo} is frozen. Filed CR ${cr.id.slice(-4).toUpperCase()} and held it open — approve it from the Board to reopen the block, or discard it.`,
      pinnedBlockId,
      'system',
    )
    return
  }

  // draft | in_review | revised → auto-approved CR + targeted revision
  const cr = await fileCR(
    pinnedBlockId,
    'human',
    `Chat: "${trimmed.slice(0, 160)}"`,
    'approved',
  )
  await requestTransition(pinnedBlockId, 'drafting', 'human', {
    approvedCR: cr.id,
  })
  queueRevision(pinnedBlockId, cr.id)
  start() // wake the loop if it went idle — continuous prompting keeps it alive
  await postMessageRow(
    'system',
    `Filed CR ${cr.id.slice(-4).toUpperCase()} against ${blockNo}; scheduled a targeted revision at the next block boundary. Nothing else will drift.`,
    pinnedBlockId,
    'system',
  )
}

/** Board: approve an open change request. */
export async function approveCR(crId: string): Promise<void> {
  const cr = await db.changeRequest.findUnique({ where: { id: crId } })
  if (!cr) throw new GatekeeperError(`Change request ${crId} not found`, 404)
  if (cr.status !== 'open') {
    throw new GatekeeperError(`CR is already ${cr.status}.`)
  }
  const block = await getBlock(cr.blockId)
  const blockNo = blockNoOf(block.orderIdx)

  await resolveCR(crId, 'approved')
  if (block.status !== 'drafting') {
    await requestTransition(block.id, 'drafting', 'human', {
      approvedCR: crId,
    })
  }
  queueRevision(block.id, crId)
  start() // wake the loop if it went idle — the approved CR restarts work immediately
  await postSystemMessage(
    `CR approved — ${blockNo} reopened for a scripted revision, queued at the next boundary.`,
  )
}

/** Board: discard an open change request. */
export async function discardCR(crId: string): Promise<void> {
  const cr = await db.changeRequest.findUnique({ where: { id: crId } })
  if (!cr) throw new GatekeeperError(`Change request ${crId} not found`, 404)
  if (cr.status !== 'open') {
    throw new GatekeeperError(`CR is already ${cr.status}.`)
  }
  await resolveCR(crId, 'discarded')
  await postSystemMessage('Change request discarded. The block keeps its current content and score.')
}
