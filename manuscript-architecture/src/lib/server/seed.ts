// Session seeding and reset. Wipes all tables and installs the scripted
// document with its sources, then emits a SessionReset carrying a full
// snapshot so every connected client can rehydrate from a single event.

import { db } from '@/lib/db'
import { DOC_TITLE, SESSION_SCRIPT } from './mock-adapter'
import { resetRuntime } from './orchestrator'
import { appendEvent, foldState, postMessageRow } from './events'
import { blockNoOf } from '@/lib/types'

async function wipeAll(): Promise<void> {
  await db.blockSource.deleteMany()
  await db.blockMeta.deleteMany()
  await db.message.deleteMany()
  await db.changeRequest.deleteMany()
  await db.block.deleteMany()
  await db.source.deleteMany()
  await db.document.deleteMany()
  await db.event.deleteMany()
}

async function seedDocument(): Promise<string> {
  const doc = await db.document.create({ data: { title: DOC_TITLE } })

  for (let i = 0; i < SESSION_SCRIPT.length; i++) {
    const s = SESSION_SCRIPT[i]
    const block = await db.block.create({
      data: {
        documentId: doc.id,
        orderIdx: i,
        type: s.type,
        content: '',
        status: 'placeholder',
      },
    })
    for (const src of s.sources) {
      const source = await db.source.upsert({
        where: { uri: src.uri },
        create: { title: src.title, snippet: src.snippet, uri: src.uri },
        update: {},
      })
      await db.blockSource.create({
        data: {
          blockId: block.id,
          sourceId: source.id,
          claimSpan: src.claimSpan,
        },
      })
    }
  }
  return doc.id
}

const globalForSeed = globalThis as unknown as {
  __manuscriptSeedPromise?: Promise<void>
}

/** Seed once per process if the store is empty. */
export function ensureSeed(): Promise<void> {
  globalForSeed.__manuscriptSeedPromise ??= (async () => {
    const doc = await db.document.findFirst({ select: { id: true } })
    if (doc) return
    await resetSession()
  })()
  return globalForSeed.__manuscriptSeedPromise
}

/** Wipe everything, reseed, reset the loop, emit SessionReset with snapshot. */
export async function resetSession(): Promise<void> {
  resetRuntime()
  await wipeAll()
  await seedDocument()
  await postMessageRow(
    'system',
    'Session initialized. Press Start to run the drafter — blocks will stream in with confidence scores.',
    null,
    'system',
  )
  // resetRuntime above cleared documentId; refold so the snapshot carries it
  const doc = await db.document.findFirst({ select: { id: true } })
  const blockCount = await db.block.count()
  await appendEvent('SessionReset', 'system', {
    documentId: doc?.id ?? null,
    blocks: blockCount,
    blockList: SESSION_SCRIPT.map((_, i) => blockNoOf(i)),
  })
  const snapshot = await foldState()
  // attach the snapshot to the SessionReset event so clients rehydrate atomically
  const evt = await db.event.findFirst({
    where: { type: 'SessionReset' },
    orderBy: { id: 'desc' },
  })
  if (evt) {
    await db.event.update({
      where: { id: evt.id },
      data: { payload: JSON.stringify({ snapshot }) },
    })
  }
  // foldState's cursor now includes the SessionReset event itself
  return
}
