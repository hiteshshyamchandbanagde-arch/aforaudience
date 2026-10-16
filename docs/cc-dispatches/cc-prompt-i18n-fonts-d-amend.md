# CC dispatch: run D amend, 6 red e2e on PR #759

> **Work on the existing branch `fix/i18n-fonts-d`** (`git fetch origin && git checkout fix/i18n-fonts-d && git reset --hard origin/fix/i18n-fonts-d`). Do NOT create a new branch. Small chunks; push after every commit; 45-min hard limit. Push, write the status file, stop. Chat merges.

**Start:** read `docs/cc-dispatches/cc-prompt-i18n-fonts-d.md`, `docs/testing-rules.md` (T2, Rule 4), and each failing spec below.

## Failures (e2e-preview run 38872950750, head b6c90d3; all failed on retry too)
1. `[mobile-chrome] e2e/tab-bar-labels.mobile.spec.ts:17` `[GEN-2609-120] tab bar labels fit at 390: ml`: "സേവ് ചെയ്തവ" now wraps.
2. `[chromium-desktop] e2e/marathi-locale.spec.ts:79`: Marathi nav chrome, "nothing clipped".
3. `[chromium-desktop] e2e/language-rollout.spec.ts:96`: language switcher gu, nav updates.
4. `[mobile-chrome] e2e/dashboard-i18n-artist.spec.ts:165` `[GEN-2610-007]`: Artist dashboard in hi, no English UI strings.
5. `[mobile-chrome] e2e/indic-mono-font.spec.ts:120` (new): `mr-four-rooms-house-390.png` 538 → 537 px tall.
6. `[chromium-desktop] e2e/indic-mono-font.spec.ts`: `mr-mono-eyebrow-1440.png` 18 → 17 px tall.

## What to do
- For 1–4, read each failure (Playwright report artifact) and say in the status file whether run D caused it. The sans stack is wider than the mono fallback, so tab-bar and nav labels can now wrap or clip.
- Fix the code, never the test. Preferred: keep the mono → sans swap but stop it from widening fixed-width chrome. Do this by scoping the swap away from the tab bar and nav labels if they rely on the old metrics, or by fixing those labels so they fit (font-size step, `white-space: nowrap` with a sensible max, or a shorter translation only if the existing string is clearly wrong; say which). No English change.
- If a failure is not caused by run D (it also fails on `origin/qa`), show that and leave it alone.
- 5–6: the new spec's screenshots differ by 1 px in height. That's the same desktop font-raster flake as BUG-2610-033. Make the shots stable (wait for `document.fonts.ready`, screenshot a fixed-height box, or assert on computed styles instead of pixels for the eyebrow). Don't raise thresholds.
- Run each of the 6 specs locally at the failing project until green, plus `e2e/homepage-hindi.spec.ts`.

## Finish
- tsc, eslint (touched files), checker/ratchet green.
- Status file `cc-autopilot-status.md`: cause of each failure, what changed, before/after. Do not touch the Feedback table.
