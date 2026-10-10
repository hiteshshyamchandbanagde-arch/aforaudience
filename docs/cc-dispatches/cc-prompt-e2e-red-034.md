# CC dispatch: e2e red on qa (BUG-2610-034)

> **New branch `fix/e2e-red-034` off `origin/qa`.** Small-chunk rule (AGENTS.md, incl. the 11 Oct tests line): one small edit, commit + push after each; run only the specs you touch, never the whole suite. **Hard stop 30 min.** Test-only change expected; do not edit `.github/workflows/`. QA DB only. Chat opens the PR and merges.

**FIRST ACTION:** status file `RESULT: PARTIAL fix/e2e-red-034 none`. Read BUG-2610-034 in the Feedback table, `docs/testing-rules.md`, `e2e/helpers/upcoming-fixtures.ts`, `e2e/helpers/events.ts`, `e2e/seed-health.spec.ts`.

1. **events-search.spec.ts:28** hardcodes seed event "Rajapalayam Comedy Jam #4" (10 Oct 19:00, now past). Use a future event from the existing upcoming-fixtures helper (or create one in setup and remove it in teardown, T6). No dated seed names in specs. If seed-health could have caught this, add that check. Grep the other specs for hardcoded seed event titles with dates within 30 days and list them (fix any that expire within 7 days).
2. **artist-browse-events.spec.ts:32 and :72** desktop screenshot diffs on qa (sharded run 38086115174). Run them locally against QA, look at the diff images. Regenerate the baseline only if the new render is correct (say why in the status file); if the page regressed, stop and report, do not regenerate.
3. Run each touched spec 3x and report pass counts.

Status file: `RESULT: PUSHED fix/e2e-red-034 <sha>`, changes, before/after, the hardcoded-title list. No Human check expected.
