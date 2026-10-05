# CC dispatch H: E2E (QA) red from time/data drift (BUG-2610-013)

> **New branch `test/qa-drift-h` off `origin/qa`.** Push after every commit. Chat merges. Autopilot.

**FIRST ACTION:** status file `RESULT: PARTIAL test/qa-drift-h none`. Budget about 70 turns. Read `docs/testing-rules.md`, `e2e/helpers/events.ts`, `e2e/colour-rules.spec.ts`, the QA seed script.

`E2E (QA)` run `37266802853` (qa `7b0855b`, 5 Oct) went red: 159 passed, 5 failed. The same suite was green on 4 Oct 15:14 (`1edc087`) and the only change between is the My Tickets page, so the clock moved, not the code.

1. **mobile-chrome:** `e2e/helpers/events.ts:21` waits for a "See all events" button on `/events` and times out. It breaks `smoke.spec.ts:25` (GEN-2609-004), `seat-availability.spec.ts:19` (GEN-2610-001), `registration.spec.ts:48`. Find why the button is gone today (a date-dependent section? an event that just went past?) and make the helper reach the event list by a path that doesn't depend on today's date.
2. **both projects:** `colour-rules.spec.ts:156` (GEN-2609-121) fails on "Hrithik has an upcoming show in the QA seed". His upcoming show has passed (QA has e.g. "Full House Open Mic" dated 2026-10-04 01:45, now in the past).
3. **Root fix, not a date bump:** every test that needs an upcoming event must get one that stays upcoming. Either the seed sets dates relative to now (re-run safe), or the spec provisions its own event at the start of the run (`@needs-db`, QA only, never production). Hard-coding a later date is not acceptable: it rots again.
4. Add a check that fails loudly and early when the seed's upcoming-event assumptions don't hold (e.g. a `seed-health` spec), so drift reads as one clear message instead of five timeouts.
5. Prove it: the full QA suite green, plus the affected specs run with the clock moved forward 30 days (`page.clock` or a seed date offset) still green.

No loosening, no skips, no raised timeouts (T2). Status file at the end: `RESULT: PUSHED test/qa-drift-h <sha>`, the cause of each failure in one line, the fix, before/after.
