# CC dispatch PERF-1: run Vercel functions in Mumbai, next to the database (BUG-2610-014)

> **New branch `perf/region-bom1` off `origin/qa`.** Push after every commit. Chat opens and merges the PR. Autopilot. Budget about 30 turns.

**FIRST ACTION:** status file `RESULT: PARTIAL perf/region-bom1 none`. Read `docs/testing-rules.md`, `vercel.json` and `src/lib/prisma.ts`.

Hitesh reports that screens take about 5 s to load. Chat measured the cause:
- Every deployment runs its functions in **iad1 (Washington)**, because `vercel.json` sets no region.
- The QA database is Supabase **ap-south-1 (Mumbai)**.
- So every query crosses the world. `prisma.ts` uses `max: 1`, which makes the queries in a request run one after another. After 10 s idle, a fresh TLS connect adds several more round trips.
- One dashboard visit makes about 10 API calls, and each one pays this cost.
- The database itself is fast at current data (21 venues).

1. **Regression test first (T1):** add `e2e/function-region.spec.ts`. It is no-auth and read-only. It requests `/api/events/` and one SSR page (`/events/`) and reads the `x-vercel-id` response header. The format is `<edge>::<function region>::<id>`, and the function region must be `bom1`. Skip the test when the header is absent (local `next dev`). It runs in the existing e2e-preview job, so no workflow change is needed. Show it **failing against the current `qa` preview** (iad1) and passing on the branch preview.
2. **Fix:** add `"regions": ["bom1"]` to `vercel.json` and keep the existing `crons` block. Change nothing else, and leave `prisma.ts` as it is.
3. Confirm the e2e-preview job is green on the branch, and note whether its run time changed. The runner is in the US, so it may get slightly slower. That's expected, not a regression.

Status file at the end: `RESULT: PUSHED perf/region-bom1 <sha>`, the test before and after, the CI link, and the **Human check**: Hitesh times 3 screens on his phone before and after (homepage, `/events`, his dashboard).
