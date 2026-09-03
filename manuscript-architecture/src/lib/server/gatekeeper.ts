// The Gatekeeper is the ONLY module allowed to change block status/content.
// Every mutation writes an Event row. API routes and the orchestrator both
// go through these functions; nothing else writes blocks directly.

import { db } from '@/lib/db'
import type { Actor, BlockStatus, BlockType } from '@/lib/types'
import { blockNoOf } from '@/lib/types'
import { appendEvent } from './events'

export class GatekeeperError extends Error {
  status: number
  constructor(message: string, status = 409) {
    super(message)
    this.name = 'GatekeeperError'
    this.status = status
  }
}

const ORDER: BlockStatus[] = [
  'placeholder',
  'drafting',
  'draft',
  'in_review',
  'revised',
  'frozen',
]

/**
 * Pure transition rule (also used by the UI to explain rejections):
 * - forward single-step along placeholder→drafting→draft→in_review→revised→frozen
 * - multi-step forward allowed only into `frozen` (the approve action), from draft/in_review/revised
 * - backwards into `drafting` allowed only with an approved change request
 *   (this is the only way out of `frozen`)
 */
export function isTransitionAllowed(
  from: BlockStatus,
  to: BlockStatus,
  hasApprovedCR: boolean,
): boolean {
  if (from === to) return false
  const fi = ORDER.indexOf(from)
  const ti = ORDER.indexOf(to)
  if (fi < 0 || ti < 0) return false
  if (ti > fi) {
    if (to === 'frozen') return fi >= ORDER.indexOf('draft')
    return ti === fi + 1
  }
  // backwards
  return to === 'drafting' && hasApprovedCR && fi > ORDER.indexOf('drafting')
}

async function getBlockOrThrow(blockId: string) {
  const block = await db.block.findUnique({ where: { id: blockId } })
  if (!block) {
    throw new GatekeeperError(`Block ${blockId} not found`, 404)
  }
  return block
}

/**
 * Append (or replace) content on a block. Frozen blocks are untouchable.
 */
export async function applyPatch(
  blockId: string,
  contentDelta: string,
  actor: Actor,
  opts: { replace?: boolean } = {},
): Promise<string> {
  const block = await getBlockOrThrow(blockId)
  if (block.status === 'frozen') {
    throw new GatekeeperError(
      `${blockNoOf(block.orderIdx)} is frozen — file a change request to edit it.`,
    )
  }
  const content = opts.replace ? contentDelta : block.content + contentDelta
  await db.block.update({ where: { id: blockId }, data: { content } })
  await appendEvent('BlockPatched', actor, {
    blockId,
    blockNo: blockNoOf(block.orderIdx),
    delta: contentDelta,
    mode: opts.replace ? 'replace' : 'append',
  })
  return content
}

/**
 * Request a status transition. Rejects anything the lifecycle forbids.
 * Pass opts.approvedCR (a CR id) to authorize a backwards reopen.
 */
export async function requestTransition(
  blockId: string,
  to: BlockStatus,
  actor: Actor,
  opts: { approvedCR?: string | null } = {},
): Promise<BlockStatus> {
  const block = await getBlockOrThrow(blockId)
  const from = block.status as BlockStatus
  if (!isTransitionAllowed(from, to, Boolean(opts.approvedCR))) {
    throw new GatekeeperError(
      `Gatekeeper rejected ${from} → ${to}${
        opts.approvedCR ? '' : ' (no approved change request)'
      }`,
    )
  }
  await db.block.update({ where: { id: blockId }, data: { status: to } })
  await appendEvent('StatusChanged', actor, {
    blockId,
    blockNo: blockNoOf(block.orderIdx),
    from,
    to,
    crId: opts.approvedCR ?? null,
  })
  return to
}

export interface MetaPatch {
  confidence?: number | null
  s1?: number | null
  s2?: number | null
  s3?: number | null
  rationale?: string | null
  alternatives?: { text: string; why: string }[]
  openQuestions?: string[]
}

/** Merge-patch BlockMeta and emit ConfidenceUpdated. */
export async function writeMeta(
  blockId: string,
  patch: MetaPatch,
  actor: Actor,
): Promise<void> {
  const block = await getBlockOrThrow(blockId)
  const existing = await db.blockMeta.findUnique({ where: { blockId } })
  const merged = {
    confidence: patch.confidence ?? existing?.confidence ?? null,
    s1: patch.s1 ?? existing?.s1 ?? null,
    s2: patch.s2 ?? existing?.s2 ?? null,
    s3: patch.s3 ?? existing?.s3 ?? null,
    rationale: patch.rationale ?? existing?.rationale ?? null,
    alternatives: patch.alternatives ?? safeArr(existing?.alternatives),
    openQuestions: patch.openQuestions ?? safeArr(existing?.openQuestions),
  }
  await db.blockMeta.upsert({
    where: { blockId },
    create: {
      blockId,
      confidence: merged.confidence,
      s1: merged.s1,
      s2: merged.s2,
      s3: merged.s3,
      rationale: merged.rationale,
      alternatives: JSON.stringify(merged.alternatives),
      openQuestions: JSON.stringify(merged.openQuestions),
    },
    update: {
      confidence: merged.confidence,
      s1: merged.s1,
      s2: merged.s2,
      s3: merged.s3,
      rationale: merged.rationale,
      alternatives: JSON.stringify(merged.alternatives),
      openQuestions: JSON.stringify(merged.openQuestions),
    },
  })
  await appendEvent('ConfidenceUpdated', actor, {
    blockId,
    blockNo: blockNoOf(block.orderIdx),
    meta: {
      confidence: merged.confidence,
      s1: merged.s1,
      s2: merged.s2,
      s3: merged.s3,
      rationale: merged.rationale,
      alternatives: merged.alternatives,
      openQuestions: merged.openQuestions,
    },
  })
}

function safeArr(raw: string | null | undefined): unknown[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export async function fileCR(
  blockId: string,
  origin: 'human' | 'critic',
  instruction: string,
  status: 'open' | 'approved' = 'open',
): Promise<{ id: string; blockNo: string }> {
  const block = await getBlockOrThrow(blockId)
  const cr = await db.changeRequest.create({
    data: { blockId, origin, instruction, status },
  })
  await appendEvent('CRFiled', origin === 'critic' ? 'critic' : 'human', {
    cr: {
      id: cr.id,
      blockId,
      blockNo: blockNoOf(block.orderIdx),
      origin,
      instruction,
      status,
      createdAt: cr.createdAt.toISOString(),
    },
  })
  return { id: cr.id, blockNo: blockNoOf(block.orderIdx) }
}

export async function resolveCR(
  crId: string,
  status: 'open' | 'approved' | 'applied' | 'discarded',
): Promise<void> {
  const cr = await db.changeRequest.findUnique({ where: { id: crId } })
  if (!cr) throw new GatekeeperError(`Change request ${crId} not found`, 404)
  await db.changeRequest.update({ where: { id: crId }, data: { status } })
  let blockNo = '?'
  if (cr.blockId) {
    const b = await db.block.findUnique({
      where: { id: cr.blockId },
      select: { orderIdx: true },
    })
    blockNo = b ? blockNoOf(b.orderIdx) : '?'
  }
  await appendEvent('CRResolved', 'gatekeeper', {
    crId,
    blockId: cr.blockId,
    blockNo,
    status,
  })
}

/** Attach a Source to a block (used when a scripted revision adds evidence). */
export async function linkSource(
  blockId: string,
  source: { title: string; snippet: string; uri: string; claimSpan: string },
): Promise<void> {
  const existing = await db.source.findUnique({ where: { uri: source.uri } })
  const src =
    existing ??
    (await db.source.create({
      data: {
        title: source.title,
        snippet: source.snippet,
        uri: source.uri,
      },
    }))
  await db.blockSource.upsert({
    where: { blockId_sourceId: { blockId, sourceId: src.id } },
    create: { blockId, sourceId: src.id, claimSpan: source.claimSpan },
    update: { claimSpan: source.claimSpan },
  })
}

export function assertBlockType(type: string): BlockType {
  if (type === 'heading' || type === 'paragraph') return type
  throw new GatekeeperError(`Unknown block type: ${type}`)
}
