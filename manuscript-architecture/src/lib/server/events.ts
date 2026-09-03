// Event log helpers: appendEvent (the single write path for events) and
// foldState (project the event-sourced store into the client-facing view).

import { db } from '@/lib/db'
import { runtime } from './runtime'
import type {
  Actor,
  BlockView,
  CRView,
  EventType,
  FoldState,
  MessageView,
  MessageRole,
} from '@/lib/types'
import { blockNoOf } from '@/lib/types'

export async function appendEvent(
  type: EventType,
  actor: Actor,
  payload: Record<string, unknown>,
): Promise<{ id: number }> {
  const row = await db.event.create({
    data: { type, actor, payload: JSON.stringify(payload) },
  })
  return { id: row.id }
}

/** Insert a Message row and emit its MessagePosted event in one place. */
export async function postMessageRow(
  role: MessageRole,
  body: string,
  pinnedBlockId: string | null,
  actor: Actor,
): Promise<MessageView> {
  let pinnedBlockNo: string | null = null
  if (pinnedBlockId) {
    const b = await db.block.findUnique({
      where: { id: pinnedBlockId },
      select: { orderIdx: true },
    })
    pinnedBlockNo = b ? blockNoOf(b.orderIdx) : null
  }
  const msg = await db.message.create({
    data: { role, body, pinnedBlockId },
  })
  const view: MessageView = {
    id: msg.id,
    role,
    body,
    pinnedBlockId,
    pinnedBlockNo,
    createdAt: msg.createdAt.toISOString(),
  }
  await appendEvent('MessagePosted', actor, { message: view })
  return view
}

export function postSystemMessage(body: string): Promise<MessageView> {
  return postMessageRow('system', body, null, 'system')
}

function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export async function foldState(): Promise<FoldState> {
  const doc = await db.document.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      blocks: {
        orderBy: { orderIdx: 'asc' },
        include: {
          meta: true,
          sources: { include: { source: true } },
        },
      },
    },
  })

  const [crRows, msgRowsAsc, eventRowsDesc] = await Promise.all([
    db.changeRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { block: { select: { orderIdx: true } } },
      take: 100,
    }),
    db.message.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    db.event.findMany({ orderBy: { id: 'desc' }, take: 250 }),
  ])
  // restore chronological order for the client
  const msgRows = [...msgRowsAsc].reverse()
  const eventRows = [...eventRowsDesc].reverse()

  const blocks: BlockView[] = doc
    ? doc.blocks.map((b) => ({
        id: b.id,
        orderIdx: b.orderIdx,
        blockNo: blockNoOf(b.orderIdx),
        type: b.type as BlockView['type'],
        content: b.content,
        status: b.status as BlockView['status'],
        updatedAt: b.updatedAt.toISOString(),
        meta: b.meta
          ? {
              confidence: b.meta.confidence,
              s1: b.meta.s1,
              s2: b.meta.s2,
              s3: b.meta.s3,
              rationale: b.meta.rationale,
              alternatives: safeParse(b.meta.alternatives, []),
              openQuestions: safeParse(b.meta.openQuestions, []),
            }
          : null,
        sources: b.sources.map((bs) => ({
          title: bs.source.title,
          snippet: bs.source.snippet,
          uri: bs.source.uri,
          claimSpan: bs.claimSpan,
        })),
      }))
    : []

  const changeRequests: CRView[] = crRows.map((cr) => ({
    id: cr.id,
    blockId: cr.blockId,
    blockNo: cr.block ? blockNoOf(cr.block.orderIdx) : '?',
    origin: cr.origin as CRView['origin'],
    instruction: cr.instruction,
    status: cr.status as CRView['status'],
    createdAt: cr.createdAt.toISOString(),
  }))

  const messages: MessageView[] = msgRows.map((m) => ({
    id: m.id,
    role: m.role as MessageView['role'],
    body: m.body,
    pinnedBlockId: m.pinnedBlockId,
    pinnedBlockNo: m.pinnedBlockId
      ? (() => {
          const b = doc?.blocks.find((x) => x.id === m.pinnedBlockId)
          return b ? blockNoOf(b.orderIdx) : null
        })()
      : null,
    createdAt: m.createdAt.toISOString(),
  }))

  const events = eventRows.map((e) => ({
    id: e.id,
    type: e.type as EventType,
    actor: e.actor,
    payload: safeParse<Record<string, unknown>>(e.payload, {}),
    createdAt: e.createdAt.toISOString(),
  }))

  const lastEvent = eventRows.length
    ? eventRows[eventRows.length - 1].id
    : 0

  return {
    cursor: lastEvent,
    document: doc ? { id: doc.id, title: doc.title } : null,
    blocks,
    changeRequests,
    messages,
    budget: { used: runtime.budgetUsed, total: runtime.budgetTotal },
    orchestratorState: runtime.state,
    events,
  }
}
