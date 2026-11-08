# CC dispatch: run L2 amend, footer-legal 390 screenshot off by 1 px (8 Nov)

> **Existing branch `fix/legal-footer-l2` (PR #764)**: `git fetch && git checkout fix/legal-footer-l2 && git reset --hard origin/fix/legal-footer-l2`; if origin/qa moved, `git rebase origin/qa` (never merge). One small commit, push, status file, stop. 30-min limit. **Never `git stash pop` on a clean tree.**

**Failure (e2e-preview on #764 head 7627259, mobile-chrome, both tries):** `e2e/footer-legal.spec.ts:26` "homepage footer links every legal page and names the company": `toHaveScreenshot footer-legal-390-mobile-chrome-linux.png` — "Expected 390x1149, received 390x1148". The baseline was made locally; on the Vercel preview the footer is 1 px shorter (fractional height / sub-pixel position of the footer element or font metrics, same class as the Run D amend in `e2e/homepage-hindi.spec.ts`).

## Fix (your new test, so a test change is fine, but no loosening)
- Find why the height is fractional (check the footer box's `getBoundingClientRect()` on the preview vs local). Make the shot deterministic WITHOUT `maxDiffPixels`/threshold/skip: e.g. screenshot a stable inner region (the Company column + copyright block) instead of the whole footer, or pin the element's size/position before the shot as the Hindi spec does, or fix a real fractional-height cause in the footer CSS if there is one.
- Regenerate the 390 and 1440 baselines in the CI-equivalent Linux environment (or from the CI run's actual output), so the first CI run is green.
- Keep all the non-screenshot assertions unchanged.
- Status file `cc-autopilot-status.md`: cause, change, before/after, pushed head SHA. No other files.
