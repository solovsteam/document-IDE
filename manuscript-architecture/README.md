# The Manuscript Architecture — Working Prototype

A Next.js implementation of the **Manuscript Architecture** Builder Specification
(`docs/The-Manuscript-Architecture_Builder-Specification.pdf`): block-level IR storage,
a Gatekeeper-enforced block lifecycle (structurally kills infinite polishing), a hybrid
confidence pipeline (s1 self-report / s2 citation coverage / s3 critic), and an
SSE-driven live UI with continuous, non-blocking chat.

Ships with a deterministic **MockAdapter** that replays a 12-block sample article with
realistic streaming, confidence signals, sources, and critique — **no LLM API key
needed** to run the full demo.

> The document on screen is never a file; it is a database view. Agents propose,
> tools dispose.

## Requirements

- Node.js 20.9+ (22 LTS recommended) — or Bun 1.1+
- No database server, no API keys

## Quickstart

```bash
git clone https://github.com/<you>/manuscript-architecture.git
cd manuscript-architecture
npm install

# create the SQLite database (Prisma auto-generates the client too)
npm run db:push

npm run dev          # → http://localhost:3000
```

On first load the app **self-seeds** a 12-block demo article into the empty database,
then streams it block-by-block with live confidence coloring.

## Production build

The project is configured with `output: "standalone"`:

```bash
npm run build
npm start            # serves .next/standalone on port 3000
```

## Docker

```bash
docker build -t manuscript-architecture .
docker run -p 3000:3000 manuscript-architecture
```

## What you can do in the UI

| Action | Where |
|---|---|
| Watch blocks stream in with confidence heat-coloring | Main canvas |
| Inspect a block's signals (s1/s2/s3), rationale, sources, open questions | Click a block → inspector panel |
| **Freeze** a block (agents can no longer touch it — only a human-approved CR reopens it) | Block context menu / inspector |
| Reject or hand-edit a block | Inspector |
| Chat continuously **without pausing the agent** | Chat drawer |
| Pin a chat message to a block → files a targeted Change Request | Pin icon on any message |
| Approve a CR → the orchestrator wakes up (even from idle) and revises that block only | CR list |
| Export the manuscript | Export API endpoint |

## Swapping in a real LLM

The adapter seam lives in `src/lib/server/mock-adapter.ts`. It implements the
`ModelAdapter` contract described in **Chapter 7 of the specification** (see `docs/`).
Implement the same interface against any provider SDK (OpenAI, Anthropic, local
models…) and swap it in the orchestrator factory in `src/lib/server/orchestrator.ts`.
The Gatekeeper, event log, confidence pipeline, and UI are provider-agnostic.

## Key API routes

| Route | Purpose |
|---|---|
| `GET /api/events` | SSE stream: every block patch, status change, confidence update |
| `GET /api/state` | Full document + block + CR snapshot (also triggers self-seed) |
| `GET /api/session` | Create/reset a session |
| `POST /api/blocks/[id]/approve` `reject` `edit` | Gatekeeper human actions |
| `POST /api/cr` + `POST /api/cr/[id]/approve` `discard` | Change Request lifecycle |
| `POST /api/messages` | Continuous chat (`pinBlockId` targets a revision) |
| `GET /api/export` | Export the manuscript |

## Notes & gotchas

- **SQLite path**: the connection string lives directly in `prisma/schema.prisma`
  (`url = "file:./custom.db"`), resolved relative to the schema file itself — zero
  configuration, no `.env` file. For Postgres, change the `provider` and switch to
  `url = env("DATABASE_URL")`.
- **Serverless hosts (Vercel etc.)**: SQLite is a local file and won't persist there.
  Self-host (VM, Docker, home server) or move to Postgres.
- **Port**: dev and start both use 3000. Change with `next dev -p XXXX` in `package.json`.
- **Moved the project folder?** Re-run `npm run db:generate` once so the Prisma client
  re-bakes the new absolute path.
- `immer` is declared explicitly because `zustand/middleware/immer` treats it as an
  optional peer (never auto-installed).

## Layout map

```
docs/                       architecture specification (PDF)
src/
  app/                      single-page UI + API routes
  components/manuscript/    canvas, inspector, chat, CR board
  lib/
    confidence.ts           hybrid signal fusion (s1·s2·s3, weighted geometric mean)
    server/
      gatekeeper.ts         lifecycle enforcement (placeholder→…→frozen)
      orchestrator.ts       agent loop (draft → critique → revise)
      mock-adapter.ts       deterministic ModelAdapter (replace for real LLMs)
      events.ts             append-only event log (source of truth)
      session.ts            human actions: freeze / reject / edit / CR / messages
prisma/
  schema.prisma             Document · Block · BlockMeta · Source · Event · CR · Message
```
