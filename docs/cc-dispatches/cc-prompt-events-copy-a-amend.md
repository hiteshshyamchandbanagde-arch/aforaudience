# CC dispatch: run A amend, one red screenshot on PR #756

> **Work on the existing branch `fix/events-copy-a`** (`git fetch origin && git checkout fix/events-copy-a && git reset --hard origin/fix/events-copy-a`). Do NOT create a new branch. Small chunks; push after every commit; 30-min hard limit. Push, write the status file, stop. Chat merges.

**Start:** read `docs/cc-dispatches/cc-prompt-events-copy-a.md`, `docs/testing-rules.md` (T2), `e2e/zero-events-copy.spec.ts`.

## The failure (e2e-preview run 38840519673, head bd59002; failed on retry too)
- `[mobile-chrome] e2e/zero-events-copy.spec.ts:31` `[BUG-2610-020] /events in a city with no events...` → `toHaveScreenshot(events-zero-city-390.png)`: 4029 px differ (ratio 0.04). Only the 390 shot failed; 1440 passed.

## What to do
1. Render the branch and `origin/qa` at 390 for this locator and compare. Say in the status file exactly what differs.
2. If the only difference is the intended Events copy A change (the zero-count line is gone, so content moved up), refresh **only** `events-zero-city-390` with `--update-snapshots` on that one spec + project, and justify it in the status file (T2: chat reviews). Do not raise thresholds, do not touch other baselines.
3. If anything else differs (spacing, wrapping, font, a missing element), that is a bug: fix the code, not the baseline.
4. Run that spec at 390 and 1440 locally until green; also re-run `e2e/events-count-copy.spec.ts`.

## Finish
- Status file `cc-autopilot-status.md` with the diff explanation, what changed, and before/after results. Do not touch the Feedback table.
