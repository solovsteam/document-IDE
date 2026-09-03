# The Manuscript Architecture — GLM sketch

This folder is the **GLM-5.3 linear-block demo**, not the DAG product.

For the product goal, recommended stack, rewrite verdict, and roadmap to a first real prototype, see **[../docs/GOAL-AND-ROADMAP.md](../docs/GOAL-AND-ROADMAP.md)**.

What this demo *is*: a Next.js UI that streams a scripted 12-block essay through a gatekeeper lifecycle (placeholder → drafting → review → freeze), with SSE, change requests, and mock confidence scores. **No LLM API key.**

What this demo *is not*: a DAG, parallel workers, cascading invalidation, a knowledge graph, or a rich-text IDE.

## Run it (verified)

Requires Node.js 20.9+ (22 LTS recommended). npm, not bun.

```bash
cd manuscript-architecture
npm install          # postinstall runs prisma generate
npm run db:push      # creates prisma/custom.db
npm run dev          # http://localhost:3000
```

Equivalent: `npm run setup` after install (generate + db push).

Open the app and press **Start**. Blocks stream with confidence coloring. Click a block for the inspector; Chat and Board are the other tabs.

If the canvas is empty, `/api/state` failed — usually Prisma was never generated. Run `npm run setup` and restart `npm run dev`.

## What you can do in this sketch

| Action | Where |
|---|---|
| Watch blocks stream with confidence gutters | Main canvas, after **Start** |
| Inspect s1/s2/s3, sources, open questions | Click a block → Inspector |
| Freeze a block | Inspector (once it is in review) |
| Reject or hand-edit | Inspector |
| Chat; pin a message to a block to file a CR | Chat tab |
| Approve a CR to reopen a block | Board tab |
| Export the event log | **Log** in the top bar → `/api/export/events` |

Revisions in this sketch are **also scripted**. Approving a CR replays a canned rewrite, not a model.

## Layout

```
src/app/                      page + API routes
src/components/manuscript/    canvas, inspector, chat, CR board
src/lib/server/
  gatekeeper.ts               lifecycle enforcement
  orchestrator.ts             sequential mock loop (700ms ticks)
  mock-adapter.ts             canned 12-block session
  events.ts                   append-only event log
prisma/schema.prisma          linear Block IR (not the product DAG)
```

## Notes

- SQLite URL is baked into `prisma/schema.prisma` (`file:./custom.db`). No `.env` required.
- This process holds the orchestrator in memory. It will not work on serverless (Vercel).
- `typescript.ignoreBuildErrors` is still on in `next.config.ts` — a smell, not a feature.
- Swapping in a real LLM is *not* the next step. The IR cannot express the product yet. See the roadmap.
