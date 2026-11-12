# CC dispatch: `application-closed` artist 1440 screenshot red twice (Rule 4)

> **Work on the existing branch `test/e2e-hardening`** (PR #782). Check it out from origin, do NOT rebase, add commits on top. Small chunks, commit + push after each. 40-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** No QA DB writes beyond what the spec already does. Never write the QA `PlatformSettings` row.

## Failure (deterministic, e2e-preview run 43198504175 attempts 1 and 2, head 39ca3ec)
`e2e/application-closed.spec.ts:105` **[chromium-desktop only]** `[BUG-2610-022]` → `toHaveScreenshot` `application-closed-artist-1440.png` on `[data-afa-application="qa-demo-app-full-hrithik-4"]`: **488 pixels (ratio 0.01) different**, the same both times. Mobile 390 passes.
- #782 doesn't touch this spec, the artist dashboard, or the seeded row. The row (`qa-demo-app-full-hrithik-4`, event `qa-demo-event-full-4` "One-Act Play Festival", 20 Sep) hasn't changed in the DB since 10 Sep.
- The same test **passed** on the qa post-merge run for `a64e12c` (#781, 09:59Z 12 Nov). It started failing on the next run, ~10:50Z.
- Suspects, in order:
  1. a time-dependent string on the card (relative date like "N days ago" / "x weeks ago", or "Past" grouping);
  2. #781's artist-list changes (`PerformanceDirectPay` / artist list dialog or chip) changing the card's layout at 1440;
  3. the rating aggregate (the "4.5 stars" part) changed by another spec's data.
  
  Confirm or correct before changing anything.

## Do
1. Reproduce locally against the branch build (`next build/start`) at 1440. Save the actual image next to the baseline and **describe the diff in words** in the status file (which text or element moved or changed).
2. Fix the **cause**:
   - If it's time-dependent text → make the test deterministic (`page.clock.setFixedTime` or a spec-owned row dated relative to now), as #782 does elsewhere. Keep the baseline if possible.
   - If #781 changed the card on purpose → refresh **only** `application-closed-artist-1440` and justify it in the commit (intended: #781 UI).
   - If it's a real regression → fix the product code and keep the baseline.
3. Don't mask, don't add `maxDiffPixels`, don't loosen or skip.

## Tests
Run `application-closed.spec.ts` (both projects) plus any spec you touch. tsc, eslint (touched files) and design-tokens must be green.

## Finish
Status file: the diff described in words, the root cause (confirmed / corrected), the fix, baselines touched with justification, and the pushed head.
