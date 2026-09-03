// MockAdapter: a deterministic scripted session. No LLM keys, no randomness —
// the "drafter" streams chunks from this script and every signal is precomputed.

import type { AlternativeView, SourceView } from '@/lib/types'

export const DOC_TITLE = 'Writing with Agents: Field Notes'

export interface RevisionScript {
  content: string
  chunkCount: number
  s1: number
  s2?: number // when the revision attaches new evidence, coverage improves
  s3: number
  rationale: string
  addSource?: { title: string; snippet: string; uri: string; claimSpan: string }
}

export interface BlockScript {
  type: 'heading' | 'paragraph'
  content: string
  chunkCount: number
  s1: number
  /** Precomputed source coverage: fraction of sentences with an attached source. */
  s2: number
  rationale: string
  alternatives: AlternativeView[]
  openQuestions: string[]
  sources: (SourceView & { claimSpan: string })[]
  criticS3: number
  criticInstruction: string
  revision: RevisionScript
}

export const SESSION_SCRIPT: BlockScript[] = [
  {
    type: 'heading',
    content: 'Introduction: The Loop You Are Watching',
    chunkCount: 4,
    s1: 0.86,
    s2: 1,
    rationale:
      'Structural heading; kept short to state the essay premise before evidence accrues.',
    alternatives: [],
    openQuestions: [],
    sources: [],
    criticS3: 0.9,
    criticInstruction: 'Heading clarity is fine; no change requested.',
    revision: {
      content: 'Introduction: Watching the Loop Watch Itself',
      chunkCount: 4,
      s1: 0.88,
      s3: 0.9,
      rationale: 'Heading sharpened to make the self-referential frame explicit.',
    },
  },
  {
    type: 'paragraph',
    content:
      "The unit of work here is not the document; it is the block. A block is a small claim on the reader's attention, and each one carries its own paper trail: who wrote it, what evidence backs it, and how confident the system is that it deserves to survive. Watch the gutter on the left edge — its color is the system telling you how it feels about each claim.",
    chunkCount: 8,
    s1: 0.88,
    s2: 0.667,
    rationale:
      "Framing paragraph grounded in the spec's block-IR chapter; the trust claim is supported by external field research.",
    alternatives: [
      {
        text: "Open with a definition of 'event sourcing' instead.",
        why: 'Rejected: definitions before motivation lose the reader; the paper-trail idea lands better as narrative.',
      },
    ],
    openQuestions: [
      'Should the gutter color also encode freshness — how long since the block was last edited?',
    ],
    sources: [
      {
        title: 'The Manuscript Architecture — Ch. 4: The Block IR',
        snippet:
          'Blocks are addressable units of prose with stable identities and per-block provenance.',
        uri: 'spec://manuscript-architecture/ch4-block-ir',
        claimSpan: 'The unit of work here is not the document; it is the block.',
      },
      {
        title: 'Field Notes on Editor Trust (2019)',
        snippet:
          'Readers judge a draft by its weakest visible claim, not by its average quality.',
        uri: 'https://example.org/editor-trust',
        claimSpan: 'its color is the system telling you how it feels about each claim',
      },
    ],
    criticS3: 0.9,
    criticInstruction: 'Framing reads well; sources cover the load-bearing claims.',
    revision: {
      content:
        "The unit of work here is not the document; it is the block. Each block is a small claim on the reader's attention with its own paper trail: authorship, evidence, and a confidence score the system maintains as the draft evolves. The gutter on the left edge is that score made visible — the system telling you, block by block, how it feels.",
      chunkCount: 8,
      s1: 0.9,
      s3: 0.85,
      rationale:
        'Tightened after review; removed the second-person aside that duplicated the closing line.',
    },
  },
  {
    type: 'heading',
    content: 'The Block Is the Unit of Trust',
    chunkCount: 3,
    s1: 0.83,
    s2: 1,
    rationale: 'Section heading; states the chapter thesis in eight words.',
    alternatives: [],
    openQuestions: [],
    sources: [],
    criticS3: 0.88,
    criticInstruction: 'Heading is clear; no change requested.',
    revision: {
      content: 'The Block Is the Unit of Trust — and of Distrust',
      chunkCount: 3,
      s1: 0.85,
      s3: 0.88,
      rationale: 'Added the counterterm to signal that distrust is a feature here.',
    },
  },
  {
    type: 'paragraph',
    content:
      'Every mutation in this prototype is an event, appended to a single ordered log. The document you are reading is not a file but a fold over that log — a deterministic replay of decisions. Scrub back through the history and any prior state of the draft can be reconstructed exactly, including the one where you changed your mind.',
    chunkCount: 8,
    s1: 0.78,
    s2: 0.667,
    rationale:
      "Core architecture claim; directly restated from the spec's event-sourcing chapter with a canonical external reference.",
    alternatives: [
      {
        text: 'Add a code sample of the fold function.',
        why: 'Rejected: the prototype should demonstrate the fold by running it, not by showing it.',
      },
    ],
    openQuestions: [],
    sources: [
      {
        title: 'The Manuscript Architecture — Ch. 7: Event-Sourced Drafts',
        snippet:
          'The store keeps an append-only event log; document state is a fold, never a mutation.',
        uri: 'spec://manuscript-architecture/ch7-events',
        claimSpan:
          'The document you are reading is not a file but a fold over that log',
      },
      {
        title: 'Designing Data-Intensive Applications, ch. 11',
        snippet:
          'Event logs as systems of record enable deterministic state reconstruction.',
        uri: 'https://example.org/ddia-event-log',
        claimSpan: 'Every mutation in this prototype is an event',
      },
    ],
    criticS3: 0.85,
    criticInstruction: 'Claims match the spec; keep as drafted.',
    revision: {
      content:
        "Every mutation in this prototype is an event appended to a single ordered log, and the document is a fold over that log rather than a file. Because the fold is deterministic, any prior state of the draft can be reconstructed exactly — including the state where you changed your mind. The log is the manuscript's memory; the canvas is only its present tense.",
      chunkCount: 8,
      s1: 0.8,
      s3: 0.85,
      rationale:
        'Closed with a memory/present-tense contrast after the critic noted the flat ending.',
    },
  },
  {
    // The deliberately weak block: low self-assessment, zero sources.
    // The critic path visibly triggers here: C = 0, s3 rescue fails, CR is filed.
    type: 'paragraph',
    content:
      'Where the loop gets honest is at the edges of its own knowledge. The drafter can assert, but assertion is not verification, and some claims arrive with nothing at all behind them. This paragraph is deliberately one of those — read it with suspicion.',
    chunkCount: 7,
    s1: 0.42,
    s2: 0,
    rationale:
      'Drafted from model memory with no retrievable source; retained intentionally to expose the confidence floor and trigger the critic path.',
    alternatives: [
      {
        text: 'Delete the paragraph entirely.',
        why: 'Rejected: deleting weak claims hides the gap; surfacing it keeps the review queue honest.',
      },
      {
        text: "Hedge every sentence with 'perhaps'.",
        why: 'Rejected: hedging lowers reader trust without adding any evidence.',
      },
    ],
    openQuestions: [
      'Which sentence here deserves a source first?',
      'Should the critic auto-draft a sourced replacement?',
    ],
    sources: [],
    criticS3: 0.45,
    criticInstruction:
      'Paragraph cites no sources (s2 = 0). Attach evidence for the verification claim or rewrite it as an explicit open question.',
    revision: {
      content:
        'Where the loop gets honest is at the edges of its own knowledge: assertion is not verification. This paragraph initially arrived with nothing behind it, and the critic flagged it — the revision you are reading exists only because that change request was approved and a source was attached. The gap is now documented rather than hidden.',
      chunkCount: 8,
      s1: 0.62,
      s2: 0.667,
      s3: 0.6,
      rationale:
        'Revised after CR approval; the verification claim now carries an attached source.',
      addSource: {
        title: 'Verification Debt in Agentic Writing',
        snippet:
          'Unsourced claims accrue verification debt that must be repaid before a block can freeze.',
        uri: 'https://example.org/verification-debt',
        claimSpan: 'assertion is not verification',
      },
    },
  },
  {
    type: 'heading',
    content: 'Confidence Is a Conversation',
    chunkCount: 3,
    s1: 0.84,
    s2: 1,
    rationale: 'Section heading; frames scoring as dialogue rather than verdict.',
    alternatives: [],
    openQuestions: [],
    sources: [],
    criticS3: 0.9,
    criticInstruction: 'Heading is clear; no change requested.',
    revision: {
      content: 'Confidence Is a Conversation, Not a Verdict',
      chunkCount: 3,
      s1: 0.86,
      s3: 0.9,
      rationale: 'Extended the heading to name the failure mode it argues against.',
    },
  },
  {
    type: 'paragraph',
    content:
      "Confidence here is a hybrid of three signals rather than a single vibe. s1 is the drafter's self-assessment, s2 is source coverage — the fraction of sentences with evidence attached — and s3 is the critic's independent read; the composite is a weighted geometric mean that refuses to let one optimistic signal carry a block.",
    chunkCount: 8,
    s1: 0.64,
    s2: 0.5,
    rationale:
      'Defines the scoring model; sourced to the spec, but the drafter certainty is deliberately modest so the critic pass triggers.',
    alternatives: [
      {
        text: 'Show the formula as an equation block.',
        why: 'Rejected: the signal bars in the inspector demonstrate it better than notation.',
      },
    ],
    openQuestions: [
      'Are the weights (0.4 / 0.3 / 0.3) right, or should coverage dominate?',
    ],
    sources: [
      {
        title: 'The Manuscript Architecture — Ch. 9: Hybrid Confidence',
        snippet:
          'Composite confidence is a weighted geometric mean of drafter, coverage, and critic signals.',
        uri: 'spec://manuscript-architecture/ch9-confidence',
        claimSpan: 'the composite is a weighted geometric mean',
      },
    ],
    criticS3: 0.55,
    criticInstruction:
      'Definition block; the modest score reflects genuine residual uncertainty.',
    revision: {
      content:
        'Confidence here is a hybrid of three signals: the drafter self-assessment, source coverage measured as the fraction of sentences with evidence attached, and the critic independent read. The composite is a weighted geometric mean, chosen because a geometric mean punishes a single weak signal instead of averaging it away.',
      chunkCount: 8,
      s1: 0.72,
      s2: 1.0,
      s3: 0.8,
      rationale:
        'Revised after CR approval; the aggregation claim now carries a supporting source.',
      addSource: {
        title: 'Why Geometric Means Discipline Scores',
        snippet:
          'Geometric aggregation penalizes low component scores more faithfully than arithmetic means.',
        uri: 'https://example.org/geometric-means',
        claimSpan: 'a weighted geometric mean',
      },
    },
  },
  {
    type: 'paragraph',
    content:
      "When the composite dips below the review threshold, a critic task spawns and reads the block cold. The critic scores what the drafter cannot see: whether the prose hedges where it should commit, and whether the sources actually support the sentences they sit under. Sometimes the critic's read lifts the score; sometimes it files a change request instead.",
    chunkCount: 8,
    s1: 0.9,
    s2: 0.667,
    rationale:
      'Describes the critic pass; both mechanisms are spec-anchored and cross-referenced.',
    alternatives: [],
    openQuestions: [
      'Should critic passes stream their reasoning into the chat panel?',
    ],
    sources: [
      {
        title: 'The Manuscript Architecture — Ch. 8: The Critic Role',
        snippet:
          'Critics review below-threshold blocks with fresh context and may file change requests.',
        uri: 'spec://manuscript-architecture/ch8-critic',
        claimSpan: 'a critic task spawns and reads the block cold',
      },
      {
        title: 'Peer Review at Machine Speed',
        snippet:
          'Cold readers catch hedging and source-claim mismatches that authors normalize.',
        uri: 'https://example.org/cold-review',
        claimSpan: 'whether the sources actually support the sentences they sit under',
      },
    ],
    criticS3: 0.8,
    criticInstruction: 'Mechanism description matches implementation; keep.',
    revision: {
      content:
        'When the composite dips below the review threshold, a critic task spawns and reads the block cold, scoring hedging and source-claim fit. When the critic read disagrees with the drafter, the disagreement becomes a change request — a ticket a human must resolve. Confidence is downstream of that argument, never upstream of it.',
      chunkCount: 8,
      s1: 0.85,
      s3: 0.85,
      rationale:
        'Replaced the see-saw ending with the downstream-of-argument claim after review.',
    },
  },
  {
    type: 'heading',
    content: 'The Gatekeeper and the Freeze',
    chunkCount: 3,
    s1: 0.87,
    s2: 1,
    rationale: 'Section heading; names the enforcement component.',
    alternatives: [],
    openQuestions: [],
    sources: [],
    criticS3: 0.9,
    criticInstruction: 'Heading is clear; no change requested.',
    revision: {
      content: 'The Gatekeeper Owns the Freeze',
      chunkCount: 3,
      s1: 0.89,
      s3: 0.9,
      rationale: 'Reworded to stress single ownership of status transitions.',
    },
  },
  {
    type: 'paragraph',
    content:
      'A block moves through six states in one direction: placeholder, drafting, draft, in review, revised, frozen. The gatekeeper rejects any step that skips the chain, and a frozen block opens only with an approved change request. That is why the freeze means something — it is a checkpoint with an audit log, not a convention.',
    chunkCount: 7,
    s1: 0.92,
    s2: 1,
    rationale:
      'Lifecycle summary fully covered by spec citations; the strongest sourced paragraph in the session.',
    alternatives: [],
    openQuestions: [],
    sources: [
      {
        title: 'The Manuscript Architecture — Ch. 6: The Gatekeeper',
        snippet:
          'A single component owns all status transitions; every other actor only requests.',
        uri: 'spec://manuscript-architecture/ch6-gatekeeper',
        claimSpan: 'The gatekeeper rejects any step that skips the chain',
      },
      {
        title: 'Immutability as a UX Contract',
        snippet:
          'Locked regions with explicit escape hatches outperform soft locks for user trust.',
        uri: 'https://example.org/immutability-ux',
        claimSpan: 'a frozen block opens only with an approved change request',
      },
    ],
    criticS3: 0.9,
    criticInstruction: 'Fully sourced lifecycle summary; no change requested.',
    revision: {
      content:
        'A block moves through six states in one direction: placeholder, drafting, draft, in review, revised, frozen. The gatekeeper rejects skipped steps, and a frozen block opens only through an approved change request — a checkpoint with an audit log, not a convention. Everything else in the system may request; only the gatekeeper may write.',
      chunkCount: 7,
      s1: 0.94,
      s3: 0.92,
      rationale:
        'Ended on the request/write asymmetry, which is the actual enforcement story.',
    },
  },
  {
    type: 'paragraph',
    content:
      'Continuous prompting is the quiet killer of field reliability. Pin a chat message to a drafted block and the system files a change request against exactly that block — nothing else drifts. Pin ten messages in a burst of enthusiasm and the revision queue becomes the backlog; the loop teaches what a good editor does: feedback waits for the boundary.',
    chunkCount: 9,
    s1: 0.7,
    s2: 0.5,
    rationale:
      'Argument block with one strong source; drafter certainty mid-range, critic read lifts the composite.',
    alternatives: [
      {
        text: 'Use a war-story anecdote instead of the queue example.',
        why: 'Rejected: the viewer can trigger the queue live; pointing at it is stronger.',
      },
    ],
    openQuestions: ['Add a revision-queue depth metric to the Board?'],
    sources: [
      {
        title: 'The Manuscript Architecture — Ch. 10: Continuous Review',
        snippet:
          'Unbounded streaming feedback degrades revision quality; boundary-scheduled edits preserve it.',
        uri: 'spec://manuscript-architecture/ch10-continuous-review',
        claimSpan: 'feedback waits for the boundary',
      },
    ],
    criticS3: 0.9,
    criticInstruction:
      'Argument is sound; the critic read confirms it and lifts the composite.',
    revision: {
      content:
        'Continuous prompting is the quiet killer of field reliability: feedback that arrives mid-stream forces the loop to revise a moving target. Pinning a message to a block converts enthusiasm into an auditable ticket that waits for the block boundary. The queue is not bureaucracy — it is the difference between revising and thrashing.',
      chunkCount: 9,
      s1: 0.78,
      s2: 1.0,
      s3: 0.85,
      rationale: 'Revised after CR approval; the thrash claim now carries a second source.',
      addSource: {
        title: 'Thrash vs. Revise: Scheduling Editor Feedback',
        snippet:
          'Batching edits at block boundaries reduces thrash and improves final-pass quality.',
        uri: 'https://example.org/boundary-edits',
        claimSpan: 'waits for the block boundary',
      },
    },
  },
  {
    type: 'paragraph',
    content:
      'The field note worth keeping is this: agents write well when the system around them is honest about doubt. Confidence bands, gated freezes, and one auditable event log are not bureaucracy — they are the difference between a draft that was merely generated and a manuscript you can defend. You have been watching the argument make itself.',
    chunkCount: 10,
    s1: 0.94,
    s2: 1,
    rationale:
      'Closing note; synthesizes the preceding sections and is fully covered by sources.',
    alternatives: [
      {
        text: 'End with a call to action.',
        why: 'Rejected: the essay observes a loop the reader is inside; a CTA would break the frame.',
      },
    ],
    openQuestions: [],
    sources: [
      {
        title: 'The Manuscript Architecture — Ch. 12: Field Notes',
        snippet: 'Trustworthy drafts come from honest doubt, not confident generation.',
        uri: 'spec://manuscript-architecture/ch12-field-notes',
        claimSpan: 'agents write well when the system around them is honest about doubt',
      },
      {
        title: 'The Craft of Defensible Prose',
        snippet: 'A defensible manuscript records why each claim survived review.',
        uri: 'https://example.org/defensible-prose',
        claimSpan: 'a manuscript you can defend',
      },
    ],
    criticS3: 0.92,
    criticInstruction: 'Strong closer; no change requested.',
    revision: {
      content:
        'The field note worth keeping: agents write well when the system around them is honest about doubt. Bands, freezes, and the event log are the difference between a draft that was merely generated and a manuscript you can defend — every claim carries the story of how it survived. You have been watching the argument make itself.',
      chunkCount: 10,
      s1: 0.95,
      s3: 0.93,
      rationale:
        'Compressed the first clause and added the every-claim-carries-a-story line.',
    },
  },
]

/**
 * Split content into n deterministic chunks on word boundaries.
 */
export function chunkContent(text: string, n: number): string[] {
  const words = text.split(' ').filter(Boolean)
  const count = Math.max(1, Math.min(n, words.length))
  const per = Math.ceil(words.length / count)
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += per) {
    chunks.push(words.slice(i, i + per).join(' '))
  }
  return chunks.map((c, i) => (i < chunks.length - 1 ? `${c} ` : c))
}
