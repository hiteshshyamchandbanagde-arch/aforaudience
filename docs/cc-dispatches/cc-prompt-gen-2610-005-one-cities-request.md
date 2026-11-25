# CC dispatch: GEN-2610-005 follow-up — one city-list request per "Use my location" tap

> **New branch `fix/gen-2610-005-one-cities-request` off `origin/qa`** (qa now has #786). Small chunks, commit + push after each. 30-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** No migrations, no QA DB writes.

## Context
- #786 (merged, `1d3ffad`) fixed the spec race: waits for the Jaipur POST before reload, gates the saved-city GET until after the tap.
- Your earlier autopilot branch `fix/gen-2610-005-tap-gate` has a product fix chat wants to keep: **commit `9701288`** — `LocationChip` keeps the pending `/api/venues/cities` request in a ref shared by the picker and the tap, and waits for it and the saved-city read together (`Promise.all`); a failed request clears the ref (BUG-2610-032 kept). It adds the e2e `tapped while the city list is loading: one city-list request, not two` (fails on qa with 2 requests).
- Drop that branch's other commits (`081423f` timings attach, `68a9680` gate) — #786 covers the gate.

## Do
1. `git fetch origin fix/gen-2610-005-tap-gate` and `git cherry-pick 9701288` onto the new branch. Resolve any conflict in `e2e/use-my-location.spec.ts` keeping **#786's** version of the existing tap-before-load test unchanged; only add the new test.
2. Regression evidence: the new test fails on `origin/qa`'s `LocationChip.tsx` (2 requests) and passes on the branch — show both.
3. Run `use-my-location.spec.ts` both projects `--repeat-each=5`; tsc, eslint (touched files), design-tokens green.

## Finish
Status file: conflict resolution (if any), before/after for the new test, pushed head, Human check: none.
