# CC dispatch D: fix the goal-proof test's flake (BUG-2610-011)

> **New branch `test/goal-flake-d` off `origin/qa`.** Push after every commit. Chat merges. Autopilot.

**FIRST ACTION:** status file `RESULT: PARTIAL test/goal-flake-d none`. Budget about 60 turns. Read `docs/testing-rules.md`, `e2e/design-system-goal.spec.ts`, `e2e/helpers/*`.

`design-system-goal.spec.ts:107` (chromium-desktop) flaked twice in CI: PR #726 (browser error) and run `37192752287` (`locator.click` on a button timed out at 15 s, passed on retry). It is the central-control goal proof, so **fix it; don't quarantine it, don't loosen it, don't just raise timeouts.**

1. Find what delays or blocks the click: run the spec with `--repeat-each=10 --project=chromium-desktop` against QA (this spec is `@needs-db`: the autopilot has `E2E_DATABASE_URL`, so **run only this spec** and wait for any `E2E (QA)` or `e2e-preview` run in progress to finish first, checking with `gh run list` if available, or else simply run it). Use traces (`--trace on`) to see what's on top of the button or why it's disabled.
2. Fix the cause in the test (wait for the real readiness signal: the button enabled, the overlay or toast gone, the token list loaded), or in `src/` if the UI has a real race. Then say which.
3. Prove it: `--repeat-each=10` green twice.

Status file at the end: `RESULT: PUSHED test/goal-flake-d <sha>`, the cause in one line, the fix, and the repeat results.
