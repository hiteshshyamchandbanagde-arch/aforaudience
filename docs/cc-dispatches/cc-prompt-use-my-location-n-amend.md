# CC dispatch N-amend: make GEN-2610-005's desktop e2e green

> **Existing branch `feat/use-my-location-n`** (head `f26aecb`). FIRST rebase it onto `origin/qa` (now `fe96e37`, M merged as #741). Never merge. Push after every commit. Chat merges. Autopilot. Budget about 50 turns. Do not edit `.github/workflows/`. QA DB only.

**FIRST ACTION:** status file `RESULT: PARTIAL feat/use-my-location-n none`.

e2e-preview on `f26aecb` (run 37567134496): 208 passed, **3 failed**, all in `e2e/use-my-location.spec.ts`, all **chromium-desktop** (390 passed). Failed on retry too, so these are deterministic.

1. **Lonavala (l.117) and permission denied (l.142):** `chip()` expected `"📍…▾"` and received `"📍Des Moines (US)▾"`. Cause: `settledChipText` waits with `not.toHaveText(/^…/)`, but on desktop the chip text starts with 📍, so the regex never matches the placeholder. It returns `"📍…▾"` before the IP city resolves (the CI runner's IP geolocates to Des Moines). Fix the wait so it allows the optional 📍 prefix (same shape as `chipReads`), e.g. `/^(📍)?\s*…/`. Test-only, no product change.
2. **Saved Jaipur prompt (l.153):** `toHaveScreenshot(use-my-location-prompt-1440.png)` reports 112 px (1%) different on `getByRole('menu').getByRole('status')`. Find out WHY before touching the baseline. Compare what the status box renders on the preview with what the baseline shows. If the difference is a real rendering problem, fix the product. Only if it is a benign environment difference (fonts or antialiasing between where the baseline was made and the CI preview), regenerate that one baseline from the CI preview run. Say which it was in the status file, with evidence.
3. After both, check the other desktop tests in the spec. Same `settledChipText` path, so confirm none of them pass only by accident.

Status file at the end: `RESULT: PUSHED feat/use-my-location-n <sha>`, what each failure was (cause plus fix), and the e2e-preview result on the new head.
