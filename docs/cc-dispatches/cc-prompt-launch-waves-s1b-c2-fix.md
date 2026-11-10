# CC dispatch: run S1b-c2-fix — whole-pixel "opening soon" note (deterministic screenshot)

> **Work on the existing branch `fix/launch-waves-s1b-c2`** (PR #777; check it out from origin, do NOT rebase, do NOT branch off qa). Small chunks, commit + push after each. 25-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** No DB changes; never write the QA PlatformSettings row.

## Failure (Rule 4: failed twice, deterministic — e2e-preview run 42865587008 attempts 1+2)
`e2e/launch-waves-states.spec.ts:76` **[chromium-desktop only]** → `toHaveScreenshot` `wave-w2-applications-soon-1440.png`: "Expected an image 480px by 48px, received 480px by 47px. 690 pixels (ratio 0.03)". Mobile passes. #777 hid the artist card's "Goes live immediately…" sentence, which moved the note vertically.

## Chat's diagnosis — confirm or correct
The W2 "Applications open soon" note (the shared `WaveSoonNote` / the element the test screenshots) has a **fractional rendered height** (~47.5px: a non-integer line-height × font-size and/or fractional padding/border), so its rasterised height rounds to 48 or 47 depending on its sub-pixel y offset. That breaks the design rule *whole-pixel line heights* (docs/design.md §9.0). Measure it (`getBoundingClientRect().height` at 1440 and 390) before changing anything.

## Fix
- Make the note's box whole-pixel at every breakpoint: integer `line-height` in px (token if one exists) and integer padding/border, in `WaveSoonNote` (or wherever the style lives) — fix the component, not the test.
- Do **not** loosen thresholds, mask, or add `maxDiffPixels`. If the corrected box is exactly the old 48px the existing baseline should pass untouched; if the corrected height differs, refresh **only** the affected `wave-*` baselines and justify each in the commit message (intended: whole-pixel fix).
- Add a tiny e2e assertion in the same spec: the note's `getBoundingClientRect().height` is an integer at 390 and 1440 (guards against regressions).

## Tests
Run locally: `launch-waves-states.spec.ts` (both projects) and `launch-waves-ui.spec.ts`. tsc, eslint (touched), design-tokens green.

## Finish
Status file: measured heights before/after, root cause confirmed or corrected, baselines touched (if any), pushed head. Do not touch the Feedback table or any DB.
