# CC dispatch: run S1a amend, admin Settings regression from the new toggle (8 Nov)

> **Existing branch `feat/paid-switch-s1a` (PR #767)**: `git fetch && git checkout feat/paid-switch-s1a && git reset --hard origin/feat/paid-switch-s1a`; if origin/qa moved, `git rebase origin/qa` (never merge). Small commit(s), push, status file, stop. 30-min limit. **Never `git stash pop` on a clean tree.**

**Failure (e2e-preview on #767 head c5d7ecb, mobile-chrome only, both tries):** `e2e/admin-direct-payouts.spec.ts:44` [BUG-2609-051] "Direct payouts past its auto-disable time shows OFF with an 'Expired on' note" — `toHaveScreenshot(direct-payouts-toggle-expired-390.png)`: 835 px (7%) differ. Locator: `locator('div').filter({ has: getByRole('heading', { name: 'Direct payouts (Razorpay Route)' }) }).last().getByRole('checkbox').locator('xpath=ancestor::label')`. Passed on origin/qa (617 others green), so S1a's new "Paid bookings" card/toggle in `src/app/dashboard/admin/settings/page.tsx` changed what this locator resolves to or how the Direct payouts toggle renders at 390.

## Fix
- Diagnose first (compare the 390 render on origin/qa vs the branch). Likely causes: the new toggle reused the same label/toggle component with different width/wrapping, or the new card sits inside the same wrapper so `.last()` now resolves a different element.
- Fix the **product** side if the Direct payouts toggle actually looks different now (that's a real regression: restore its look; style the new toggle to match the existing toggle pattern). Only if the Direct payouts card is pixel-identical and only the locator now hits another element, make the locator more specific (scope to the Direct payouts card by a stable `data-` attribute) — no baseline change, no threshold change.
- Do not touch any other spec or baseline. Run only this spec + `e2e/admin-paid-bookings.spec.ts` locally at 390 and 1440.
- Status file `cc-autopilot-status.md`: cause, change, before/after, pushed head SHA.
