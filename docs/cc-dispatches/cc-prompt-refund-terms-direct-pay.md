# CC dispatch: refund terms for the direct-pay model (Hitesh, 12 Nov)

> **Branch off `origin/qa`: `fix/refund-terms-direct-pay`.** Small chunks, commit + push after each. **One locale file per tool call.** 40-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** No DB changes. Never write the QA `PlatformSettings` row.

## Decision (Hitesh, 12 Nov 07:57 IST)
AFA processes no payments and holds no money (10 Nov), so AFA can't issue or force refunds. AFA publishes one **standard term** that the parties agree to before paying, and keeps the record:
- **Cancelled 15+ days before the booked date: any advance is refunded in full by the party who received it. Inside 15 days: as agreed between the parties.**
- Audience tickets are free or pay-at-entry, so there's nothing to refund. The audience just cancels the reservation.
- The online-payment tiers (`src/lib/refund-policy.ts`, 14/7 days) stay in code **unchanged and dormant** for a possible Razorpay Technology Partner later (`paidBookingsEnabled` is OFF on prod). They are no longer shown publicly.

## Chunks
1. **`/refund-policy` page** (`src/app/refund-policy/page.tsx`): rewrite for the direct model. Keep `LegalDocLayout`, the section anchors where they still fit, contact, and the Shyamkasturi naming as it is now. Sections:
   - AFA charges no fee and processes no payments.
   - Tickets: free/pay-at-entry → cancel in My Tickets.
   - Venue hire and artist fees: the 15-day standard term above, paid and refunded directly between the parties.
   - If an event is cancelled: the organiser cancels in-app and every ticket holder and party is notified.
   - What AFA does: keeps the in-app record, can mediate, and may restrict accounts that repeatedly cancel late or don't refund.
   - Remove the online tiers section, the Razorpay "5–7 working days" section and the `REFUND_*_MIN_DAYS` import. Put a code comment where the online section was: "restore from git (pre-12 Nov) if paidBookingsEnabled is ever turned on". Set `lastUpdated` to the merge date. Export the 15 as `DIRECT_PAY_FULL_REFUND_MIN_DAYS = 15` from a small new module (e.g. `src/lib/direct-pay-terms.ts`), so the page and the copy can't drift.
2. **`/terms` page** (~lines 44 and 56–59): make the "Refunds and cancellations" bullet match. Don't restate the old tiers. Point to `/refund-policy/` and the 15-day standard term. Change nothing else on the page.
3. **Disclosure line**: `venueDirectPay.payDirectLine` (and the matching key for the artist screen, if `PerformanceDirectPay.tsx` uses a different section) gets a second short line: the 15-day term in plain words, e.g. "Cancel 15+ days before the date: full refund of any advance. Inside 15 days: as you both agree." Add it as a **new key** (e.g. `refundTermLine`), shown under the existing `data-afa-direct-pay-disclosure` line in `DirectPayBookings.tsx` and `PerformanceDirectPay.tsx`, with the `{days}` placeholder filled from the constant. English first, then the other 11 locales **one file per call** (Marathi included). Keep the translations natural, and keep the 15 as the placeholder.

## Tests (T1/T2)
- `e2e/legal-pages.spec.ts` (and any spec that asserts the 14/7 tiers on `/refund-policy`): update it to assert the direct-pay content, i.e. the 15-day term is present and no "50%" or "Razorpay" refund-timing text appears. This changes an existing test because the policy changed. Justify it in the commit and the status file.
- New assertion: the disclosure block on a direct-pay venue booking (e2e fixture `e2efixturevb0001`, or the D-series direct-pay specs' fixtures) shows the 15-day line at 390 and 1440. It must fail on `origin/qa` and pass on the branch.
- Refresh only the screenshot baselines that change, and justify each.
- Unit: `refund-policy.ts` is untouched, so its existing tests must still pass.
- Run locally only the specs you touched. tsc, eslint (touched files) and design-tokens must be green.

## Finish
Status file: chunks done, tests fail→pass, baselines touched, pushed head. Human check: read `/refund-policy` and `/terms` on a phone; check the Hindi/Marathi wording of the new line. Don't touch the Feedback table or any DB.

## Not in scope (next dispatch)
Cancelling after CONFIRMED (today either side can cancel only before confirm), "refund due → refund received" tracking, and a late-cancel count on profiles.
