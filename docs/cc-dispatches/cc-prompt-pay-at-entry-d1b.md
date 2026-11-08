# CC dispatch: run D1b, organiser payment-mode picker (finish D1)

> **Existing branch `feat/pay-at-entry-d1`**: `git fetch && git checkout feat/pay-at-entry-d1 && git reset --hard origin/feat/pay-at-entry-d1`; if origin/qa moved, `git rebase origin/qa` (never merge). Small chunks: one edit, commit, push; one dictionary file per call. 40-min limit. Push, status file, stop. **Never `git stash pop` on a clean tree.**

**Context:** D1 (8b68c15) built Pay at entry + attendance end to end; its migration `20261108180000_add_pay_at_entry_attendance` is **already applied to QA** by chat (18 events -> ONLINE, 28 bookings -> ONLINE, 10 -> ATTENDED). Read the D1 status file on the branch first. Left: the organiser's explicit payment-mode picker in event create/edit.

## Do
- In the organiser event create and edit forms, a 3-way choice: **Free** / **Pay at entry** (price required; helper text "Audience reserves on AforAudience and pays you directly at the venue — cash or UPI. AforAudience does not collect this payment.") / **Online payment** (only selectable when `paidBookingsEnabled` is ON; when OFF show it disabled with "Coming soon").
- Default for a new priced event while online payments are OFF = Pay at entry. Editing an existing ONLINE event while the switch is OFF: keep its mode visible, don't silently convert it.
- Send `paymentMode` to the existing server validation from D1 (`src/lib/pay-at-entry.ts`); reuse its errors. No server rule changes unless a test proves a gap.
- Design tokens only; 12 locales one file per call.
- **Razorpay stays switchable:** do not touch online checkout / order / verify / webhook / refund code.

## Tests (T1)
- e2e (Omkar, QA; clean up): create a Pay-at-entry event via the form → event page shows "pay … at entry" + Reserve; Online option disabled when the switch is OFF is covered by injecting the flag (don't flip the global QA setting in parallel runs). Screenshots 390/1440 of the picker.
- tsc, unit self-tests, eslint (touched), design-tokens checker green.

## Finish
Update the branch status file (T7) for the WHOLE D1 (D1 + D1b): files, tests added, before/after, Human check (Hitesh: create a pay-at-entry show on phone as an organiser; reserve it as audience; check in from the guest list). Do not touch the Feedback table or any DB.
