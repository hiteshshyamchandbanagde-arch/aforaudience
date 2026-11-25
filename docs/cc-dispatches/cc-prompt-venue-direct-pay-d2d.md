# CC dispatch: run D2d, fix design-tokens failure on PR #769 (raw button)

> **Existing branch `feat/venue-direct-pay-d2`** (head 8e0c93a): `git fetch && git checkout feat/venue-direct-pay-d2 && git reset --hard origin/feat/venue-direct-pay-d2`; if origin/qa moved, `git rebase origin/qa` (never merge). One small commit, push, status file (do NOT commit it), stop. 20-min limit.

**Failure:** required check `design-tokens` on #769: `src/app/dashboard/venue/edit/page.tsx:215 [raw-button]` — the D2b "Remove QR" control is a raw `<button type="button" data-afa-upi-qr-remove className="avp-btn-outline" …>`.

## Do
- Replace it with the shared `Button` component (`src/components/ui/Button.tsx`) using the variant/size that matches the neighbouring outline controls on this page (look at how other outline actions on the page/related pages use `Button`); keep `data-afa-upi-qr-remove` and the onClick. No `token-ok` suppression.
- Check the rest of the D2 diff for any other raw/bare `<button>` (`node scripts/check-design-tokens.js` or the repo's checker command over the changed files) and fix those the same way.
- Run the design-tokens checker + ratchet, tsc, and `e2e/venue-direct-pay.spec.ts` locally (QR remove step) — all green. If the remove-button screenshot baseline changes, regenerate only that baseline and justify.

## Finish
Status file (T7, not committed): change, checker before/after, pushed head. Do not touch the Feedback table or any DB.
