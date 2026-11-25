# CC dispatch: run R2, Hindi eyebrow screenshot drift (Hitesh "strict: fix first", 8 Nov)

> **Work on the EXISTING branch `fix/e2e-date-drift-r` (PR #762)**: `git fetch && git checkout fix/e2e-date-drift-r && git reset --hard origin/fix/e2e-date-drift-r`. If origin/qa has moved, `git rebase origin/qa` (never merge). One small commit, push, status file, stop. 30-min hard limit. Chat merges. **Never `git stash pop` on a clean tree.**

**Why:** T2 (nothing merges on red) blocks #762 and #763 (legal pages for Razorpay). #762 fixes 3 of the 4 nightly reds; the 4th is on no branch yet:
- `e2e/homepage-hindi.spec.ts:110` [BUG-2610-030] (chromium-desktop, both tries; red on every nightly since ~21 Oct): `toHaveScreenshot hi-eyebrow-1440.png` "Expected 144x17, received 143x17, 206 px (0.09) differ". The eyebrow is the live tag (`hero-live-tag`, text `अभी लाइव …`) that contains a **live count from QA data**, so its width drifts as data changes. Same class as run R (data/date drift), not a product bug, unless you find otherwise.

## Fix
- Diagnose first: download nothing; read the spec and the hero-live-tag component and confirm the count is data-driven. If the diff is NOT data-driven, stop and describe it in the status file.
- If data-driven: before the screenshot, make the shot data-independent without weakening it, e.g. replace the count's digits in the DOM with a fixed value (or pin the text) so the glyph rendering of the Hindi words (what BUG-2610-030 guards: no letter-spacing on Devanagari) is still compared pixel-for-pixel. Keep the `tracking()` computed-style assertion. **No threshold change, no `maxDiffPixels`, no skip/fixme.** Regenerate `hi-eyebrow-{390,1440}` baselines in CI-equivalent Linux only if needed and justify in the status file.
- Check `/events` count test in the same file uses a regex (it does) and leave it.

## Tests (T7)
- Spec passes locally at 390 and 1440 (run only this file). Explain why the old shot fails on origin/qa when the count's width changes and the new one cannot.
- Status file `cc-autopilot-status.md`: tests changed with justification (T2 requires chat review), before/after, pushed head SHA.
- Do not touch the Feedback table. No data changes. Do not touch any other spec.
