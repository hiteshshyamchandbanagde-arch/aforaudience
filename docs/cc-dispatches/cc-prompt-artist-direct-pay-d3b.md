# CC dispatch: run D3b, organiser hi/mr Edit Profile i18n failure on PR #770

> **Existing branch `feat/artist-direct-pay-d3`** (head b362df5): `git fetch && git checkout feat/artist-direct-pay-d3 && git reset --hard origin/feat/artist-direct-pay-d3`; if origin/qa moved, `git rebase origin/qa` (never merge). Small commits, push, status file (do NOT commit it), stop. 30-min limit.

**Failure (e2e-preview on #770, both viewports, hi and mr):** `e2e/dashboard-i18n-organiser.spec.ts:359` [GEN-2610-007] "Direct Payouts and Edit Profile in hi/mr: no English UI strings" — `englishLeftIn(main, …)` on Edit Profile received 7 entries (expected []). D3 added the organiser UPI ID / UPI QR fields there.

## Do
1. Run the spec locally (hi + mr) and read the 7 entries. Split them:
   - **Real untranslated UI text** (an English label/helper/button left in hi.ts/mr.ts or hard-coded in the component) → translate it properly in the dictionaries (one file per call) / route it through `tr`.
   - **Product terms read in Latin script** — exactly the set already allowed for venues in D2c: "UPI ID", "UPI", "QR", "name@bank" → add to this spec's `PROPER_NOUNS` with a comment citing `dashboard-i18n-venue.spec.ts` (D2c) and `marathi-locale.spec.ts`. Nothing beyond that set.
2. Check `e2e/dashboard-i18n-artist.spec.ts` covers the artist Edit Profile in hi/mr; if the artist UPI fields would trip it the same way, apply the same split there.
3. Re-run the touched specs (hi + mr, 390 + 1440) and `e2e/*artist*direct*` locally — green.

## Finish
Status file (T7, not committed): the 7 entries and how each was handled, before/after, pushed head. Do not touch the Feedback table or any DB.
