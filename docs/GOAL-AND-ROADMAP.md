# Goal, stack, and roadmap

This is the working brief for the Document IDE. It is based on the product summary, a full read of the GLM-5.3 prototype in `manuscript-architecture/`, and a successful local boot of that prototype.

---

## 1. Goal (confirmed)

The product is **not** “an LLM that writes a document.”

It is an **IDE for zero-error professional writing** in which:

- The human stays on the document the whole time — drafting, editing, rejecting, freezing — while models work **elsewhere** on other nodes.
- The document is a **directed acyclic graph of typed nodes** (assumptions, claims, tables, section drafts, sources), not a linear blob of prose.
- Every generated claim has a **deterministic source path** the human can inspect.
- Upstream edits **invalidate** downstream nodes, cancel obsolete model runs, and queue re-evaluation without blocking the editor.
- Parallel workers receive **immutable contract snapshots** (typed inputs), never a shifting whole-document prompt.
- Review feels like **git: branch / diff / approve**, not like chatting with a chatbot that rewrites the file.

Software-engineering primitives map onto natural language as follows:

| Software | This IDE |
|---|---|
| Module / package | Typed node (claim, table, section, assumption) |
| Import graph | DAG edges (`depends_on`, `cites`, `contains`) |
| Type checker | Zod (or equivalent) contracts on node I/O |
| CI job | Specialized model task (research / draft / critique / verify) |
| Cache invalidation | Downstream stale flags + abort in-flight work |
| Pull request | Change request with a diff overlay |
| Merge | Human freeze / approve |
| `git blame` | Event log + source attestations |

Success is **time-and-cost to a defensible document**, not tokens generated. If managing nodes, queues, and diffs feels like extra admin, the product has failed — even if the models are good.

What this is *not*, for the first prototype:

- An auto-writer that fills the page while the human watches
- A knowledge-graph research project
- A visual node-canvas as the primary writing surface
- Multiplayer CRDT / git-of-git for whole documents

Those can come later. They are not the first slice.

---

## 2. What the GLM prototype actually is

The code in `manuscript-architecture/` is a Next.js demo titled **The Manuscript Architecture**. It is closer to a **scripted play of a 12-block essay** than to the IDE above.

### What it does well (keep these ideas)

- **Gatekeeper** as the only mutation path, with a real lifecycle: `placeholder → drafting → draft → in_review → revised → frozen`. Frozen blocks require an approved change request to reopen. This is the right instinct for high-stakes docs.
- **Append-only event log** + SSE so the canvas is a fold over events, not a file.
- **Change requests** and pinned chat → targeted revision of one unit, not a full regen.
- **Hybrid confidence** (s1 self-report, s2 citation coverage, s3 critic) as a visible gutter, not a hidden score.
- **MockAdapter seam**: the demo runs with **no API key**. That is the correct way to build the harness before wiring models.
- A usable three-pane sketch: document canvas, inspector, chat, CR board.

### What it does not do (the product)

| Product requirement | GLM prototype |
|---|---|
| DAG of typed nodes | Linear `heading \| paragraph` list, `orderIdx` only |
| Parallel workers | One `setInterval` tick every 700ms, one `currentTask` |
| Cascading invalidation | None. Editing block A does not stale block C |
| Immutable contracts / snapshots | Workers read live block rows and a hardcoded script |
| Knowledge graph | `Source` + `BlockSource` join table. No entities, no edges |
| Rich-text canvas with citation tags | Plain `<p>` / `<h2>` cards. `@mdxeditor/editor` is an unused dependency |
| Diff / PR overlay | Inspector + CR list. No textual diff |
| Specialized model instances | Scripted drafter/critic/revise with precomputed scores |
| Human edits while models run elsewhere | Sequential; human edit is refused while `drafting` |

It is also a **kitchen-sink scaffold**: ~50 unused shadcn components, unused `next-auth`, `next-intl`, `@dnd-kit`, `@mdxeditor/editor`, `@tanstack/react-query`. `typescript.ignoreBuildErrors: true`. The referenced spec PDF is not in `docs/`. The Dockerfile copied a non-existent `bun.lock`; `npm start` called `bun`.

**Verdict on fidelity:** the summary is in the right direction. The code is a UI/lifecycle sketch of a *linear auto-player*, not a DAG IDE. Do not try to “grow” the current Prisma `Block` table into the product IR. That is a rewrite of the model, not a refactor of a field.

---

## 3. Is a full rewrite advised?

**Rewrite the intermediate representation and the worker loop. Do not throw away the repo and start in a new language.**

| Keep | Rewrite | Delete / defer |
|---|---|---|
| Gatekeeper idea (single mutation API) | Linear `Block` → typed `Node` + `Edge` + `Snapshot` | Unused shadcn dump, next-auth, next-intl, dnd-kit, MDXEditor |
| Event log + SSE | `setInterval` orchestrator → abortable task queue | Scale-free knowledge graph (phase 4+) |
| CR / freeze / human-in-the-loop | Sequential one-task loop → parallel workers | React Flow as the primary editor |
| MockAdapter-first | Hardcoded `SESSION_SCRIPT` as the only “model” | Vercel/serverless as the runtime |
| Canvas + inspector + chat chrome | Cards of plain text → TipTap document with citation marks | |

A greenfield rewrite in Rust / Electron / a custom canvas would spend the first prototype on platform, not on invalidation and contracts. Next.js is adequate for the **IDE UI**. It is **not** adequate as the job runtime once you have parallel cancellable LLM work — that is a process/queue problem, not a React problem.

The current tools are **sufficient for a first prototype UI**. They are **not sufficient** as currently wired:

- In-process `setInterval` on a Next.js server cannot do parallel work, cancellation, or survive multi-instance / serverless.
- SQLite polling every 400ms is fine for a laptop demo, not for a real worker fleet.
- No schema for edges, snapshots, or tasks means the hard problems cannot even be expressed.

That is a **missing architecture**, not a missing npm package.

---

## 4. Recommended stack

### v0 — first real prototype (this is the target)

Stay boring. Optimize for a single long-lived Node process on a laptop/VM.

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript | One language across UI, contracts, workers |
| UI | Next.js App Router + React 19 | Already here; good enough for an IDE shell |
| Document editor | **TipTap** | Real rich text; citation marks as inline nodes; marks survive edits. Not MDXEditor, not a `<textarea>` |
| Client state | Zustand | Keep. Hydrate from server, reduce events |
| Live updates | SSE | Keep. Add `OrchStateChanged`. WebSocket later if needed |
| Contracts | **Zod** | Node I/O schemas. Workers validate snapshots before inference |
| Persistence | Prisma + **SQLite** | Zero-ops for v0. Schema must include Node/Edge/Task/Snapshot |
| Workers | In-process pool + `AbortController` | 2–4 concurrent mock (then real) jobs. Not `setInterval`, not serverless |
| Models | `ModelAdapter` + MockAdapter default | Swap Anthropic/OpenAI later. Structured JSON out |
| Styling | Tailwind + **~10** shadcn pieces | Delete the rest |

**Primary surface:** a document (reading order is a topological projection of the DAG). Inspector on the right shows type, contract, sources, stale dependents, running tasks.

**Secondary surface (optional, later in v0):** a small graph inspector for the DAG. Not the place you write.

### v1 — when the prototype is real enough to leave the laptop

| Layer | Choice |
|---|---|
| DB | Postgres (same Prisma schema) |
| Jobs | Postgres `SKIP LOCKED` **or** BullMQ + Redis |
| Runtime | Dedicated `worker` process, Next.js only serves HTTP/SSE |
| Retrieval | `pgvector` or `sqlite-vec` over source chunks — **not** a knowledge graph |
| Auth | Only when you have a second user |

### Explicitly not in v0

- Neo4j / RDF / “scale-free” graph extraction from prose
- Yjs / multiplayer CRDT
- Git-style branching of the whole document
- React Flow / tldraw as the writing canvas
- Deploy to Vercel (SQLite + in-process workers will not survive)

### Why not a knowledge graph yet

The product needs **traceable source paths**, not a topology research project. A claim that points at `{sourceId, span}` plus RAG over uploaded PDFs gives you attestations. Extracting a scale-free entity graph from unstructured text will hallucinate edges and blow the budget. Revisit only if citation-to-span retrieval fails at provenance.

---

## 5. Getting the GLM demo running (verified)

This demo **does boot**. It failed for the author mainly because Prisma was never generated/pushed, the README mixed bun/npm, and **Start did not update the Idle badge** even while blocks streamed.

Verified on Node 22:

```bash
cd manuscript-architecture
npm install              # postinstall: prisma generate
npm run db:push          # creates prisma/custom.db
npm run dev              # http://localhost:3000
```

Then press **Start**. You should see:

- Badge switch from Idle → Running
- Blocks stream with a caret, then confidence gutters
- Inspector / Chat / Board on the right

No API key. No Docker. Do not use `bun` unless you install it; scripts now call `node`.

**If the canvas stays empty:** `/api/state` is failing. Almost always Prisma client missing or `custom.db` not created. Run `npm run setup`.

**If blocks stream but the badge stays Idle:** you are on a revision before `OrchStateChanged` was added. Update, or hard-refresh after Start.

This demo is **not** the first product prototype. It is a reference for freeze / CR / SSE / mock-first.

---

## 6. Roadmap to the first *product* prototype

Definition of done for v0 (must all be true):

1. A document is a DAG of typed nodes (`assumption`, `claim`, `section`, `source`). Reading order is derived, not stored as the IR.
2. The human can edit node A while a worker drafts node B.
3. Editing an upstream assumption marks dependents **stale**, **aborts** their in-flight tasks, and offers re-run — without blocking the editor.
4. A worker is given a **frozen snapshot** of its input contract, not the live document.
5. A proposed write appears as a **diff**; the human accepts (freeze) or rejects (CR).
6. Every `claim` shows inspectable source spans.
7. The default path still runs **with MockAdapter** (no keys). A second adapter can call a real model.

### Phase 0 — Stabilize the sketch (done in this change set)

- `.gitignore` so `node_modules`, `.next`, and SQLite are not committed
- `npm run setup` / `postinstall` so Prisma actually generates
- Dockerfile uses `package-lock.json`; `start` uses `node`
- Orchestrator state is pushed to the client (Start looks like it works)
- This document, so nobody confuses the linear player with the product

### Phase 1 — Typed DAG IR

Replace `Block(orderIdx, heading|paragraph)` with:

```
Document
Node        type, status, content, schemaVersion, stale
Edge        fromId, toId, kind: depends_on | cites | contains
NodeSnapshot  nodeId, hash, payload JSON  // immutable worker input
Task        kind, status, nodeId, snapshotId, abortReason
Event       keep as the audit log
ChangeRequest  keep, attach to Node
Source / SourceSpan  keep, attach to claims
```

Seed a **tiny** real document, not a 12-block essay:

- 2 assumptions (e.g. market size, growth rate)
- 1 table/claim that depends on both
- 1 section prose node that cites the claim
- 2 sources

UI: same chrome. Canvas renders a **topological reading order**. Stale nodes get a badge, not a modal. Inspector lists upstream inputs and downstream dependents.

Gatekeeper stays: nothing writes node content/status except through it.

### Phase 2 — Parallel abortable workers

Replace the 700ms sequential loop with:

- A queue of `Task` rows
- A pool of 2–4 workers (`Promise` + `AbortController`)
- Ready-to-run = node not frozen, all upstreams frozen or human-approved, no stale upstream
- On upstream edit: set `stale` on reachable descendants, abort tasks whose `snapshotId` no longer matches

MockAdapter still replays canned output, but **per node type**, in parallel. This is the first time the harness is doing the job the summary describes.

Human rule: **the editor never waits on a worker.** If a node is `drafting`, the human edits a copy / files a CR; they do not get a 409 that says “wait for the boundary” except on that one node.

### Phase 3 — Diff review + TipTap

- TipTap document; citation marks are first-class (`sourceId` + span)
- Worker output is a **proposed patch** (before/after), not a silent append
- Accept → freeze; reject → CR with instruction; freeze remains sacred
- Color-coded citation tags in the prose, click → inspector

Until this lands, the product will still feel like a player, not an IDE.

### Phase 4 — One real model, structured output

- Implement `ModelAdapter` against one provider
- Force JSON that matches the node’s Zod contract (claim text + `sourceId[]` + rationale)
- Keep MockAdapter as CI and as the default `npm run dev`
- Budget and task kinds (`research | draft | critique | verify`) become real rows, not comments

Do **not** start with five models. One drafter + one critic is enough.

### Phase 5 — Retrieval (still not a knowledge graph)

- Upload/attach source documents
- Chunk + embed
- `verify` task must bind each claim to retrieved spans or fail s2
- If this is enough for “deterministic source paths,” stop. Do not build a KG for its own sake.

---

## 7. Suggested order of work (first prototype)

Do these in order. Each step should be demoable with MockAdapter.

1. **Schema + seed DAG** (phase 1) — if this is wrong, everything else is theater
2. **Stale + abort** (phase 2) — this is the product’s hard problem; prove it on mocks
3. **TipTap + diffs** (phase 3) — this is the product’s cognitive-load problem
4. **One real LLM adapter** (phase 4) — only after 1–3, or you will prompt-engineer around a bad IR
5. **Retrieval** (phase 5)

Estimated shape, not calendar: (1) and (2) are the bulk of the architecture; (3) is the bulk of the UI; (4) is a thin adapter if contracts exist; (5) is a separate system.

---

## 8. How to judge progress

The prototype is working when you can do this without talking to a chatbot:

1. Change assumption “TAM = $4B” to “$3.1B”
2. The dependent forecast node turns stale **immediately**; its running job dies
3. You keep editing the introduction while a new forecast job runs
4. A diff appears on the forecast; you reject the first pass with a one-line CR
5. The second pass cites the source span for the $3.1B figure
6. You freeze the forecast; the section that cites it is still stale until you accept a rewrite

If you cannot do that, you do not yet have the IDE. Streaming a 12-block essay with pretty gutters is not the same milestone.
