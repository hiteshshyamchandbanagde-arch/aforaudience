# CC dispatch K: e2e hygiene, covering the tour-stop leftover and goal-test cause 2 (FEAT-2608-047, BUG-2610-011)

> **New branch `test/e2e-hygiene-k` off `origin/qa`**, started after PERF-1 (`perf/region-bom1`). Push after every commit. Chat merges. Autopilot. Budget about 60 turns. Do not edit `.github/workflows/`, because the runner can't (GEN-2610-004).

**FIRST ACTION:** status file `RESULT: PARTIAL test/e2e-hygiene-k none`. Read `docs/testing-rules.md`, `e2e/artist-tour-stop.spec.ts`, `e2e/design-system-goal.spec.ts`, `e2e/goal-token-lock.spec.ts` and `HANDOFF.md` parts 47 and 49.

**1. The artist-tour-stop spec trips over its own leftovers (FEAT-2608-047).** On 5 Oct, a run cancelled mid-test left Hrithik's Lisbon stop in QA. The next run then failed on "Hrithik has no Lisbon stop to begin with". Chat deleted the stop by hand.
- Make the spec clean up at the **start**: delete any Lisbon stop owned by Hrithik, through the UI or a QA-DB helper like `deleteRegisteredTestUsers`. Keep the cleanup at the end as well.
- Prove it by seeding a leftover stop in QA, then showing the old spec fails and the new one passes. Remove the seed afterwards.
- QA DB only. Never touch production (`cncumfwwnjcwacggrgsr` is blocked).

**2. BUG-2610-011 cause 2.** `design-system-goal.spec.ts` sometimes throws "Target page, context or browser has been closed" at `context.close()`. So far it has only been seen locally.
- Root-cause it. Likely suspects are a second close of the same context (in the test and again in a fixture/afterEach), or a close racing the lock release in `finally`.
- Fix the cause; don't swallow the error. If you can reproduce it, show it failing before and passing after. If you can't, say so plainly and explain the fix from the code path. Don't claim a reproduction you didn't get.
- Run the goal spec 10 times in a row on the branch and report how many passed.

Status file at the end: `RESULT: PUSHED test/e2e-hygiene-k <sha>`, the before/after for each part, the CI link, and **Human check: none**.
