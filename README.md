# Document IDE

An IDE-style harness for **high-stakes professional documents**: humans keep writing and reviewing while specialized LLM workers run in parallel on a **DAG of typed, citable nodes**.

The GLM-5.3 prototype in `manuscript-architecture/` is a **scripted linear block player**. It is useful as a UI sketch. It is not the product architecture.

**Read this first:** [docs/GOAL-AND-ROADMAP.md](docs/GOAL-AND-ROADMAP.md)

That document:

1. Confirms the product goal
2. Recommends a stack (and what to defer)
3. Explains whether a full rewrite is advised
4. Gives verified steps to run the current demo
5. Lays out the roadmap to a first *real* prototype

## Run the current demo

```bash
cd manuscript-architecture
npm install          # also runs prisma generate
npm run db:push      # creates prisma/custom.db
npm run dev          # http://localhost:3000
```

Open the app and press **Start**. The mock drafter streams a 12-block essay. No API key is required.
