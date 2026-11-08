# CC dispatch: run S1a, "paid bookings" master switch (soft launch = free only, Hitesh 8 Nov)

> **New branch `feat/paid-switch-s1a` off `origin/qa`.** Small chunks: one edit, commit, push, next. 45-min limit; if not finished, push a working part and list what's left. Chat merges and applies the migration. **Never `git stash pop` on a clean tree.**

**Decision (Hitesh, 8 Nov):** launch option A: free discovery + free-event tickets only; NO money flows through AFA at launch (Razorpay Route not available; collect-and-payout is HIGH RISK per CA). Paid flows must be impossible on prod until an admin turns them on, and must be enforced on the SERVER, not just hidden in UI.

## 1. Setting
- Add `paidBookingsEnabled Boolean @default(false)` to `PlatformSettings` (schema + a new SQL migration file in `prisma/migrations/`, timestamp now, `ALTER TABLE ... ADD COLUMN ... DEFAULT false NOT NULL`). **Do not** set it true in the migration (prod's clean DB is built from migrations). Chat will apply it to QA via Supabase and set QA's row to true separately so existing paid e2e flows keep working.
- Read it through the existing `platform-settings.ts` loader (same caching pattern as the fee settings).

## 2. Server enforcement (the important part)
- Single guard (e.g. `assertPaidBookingsEnabled()` / `isPaidBookingsEnabled()`), called at every place money can be taken: `createRazorpayOrder` in `src/lib/razorpay.ts` (choke point), plus `src/app/api/payments/create-order/route.ts`, `src/app/api/bookings/route.ts` and `src/app/api/bookings/[id]/confirm/route.ts`. Audit with grep for any other path that creates a payable booking (venue hire with platform fee, spot fees, etc.) and list them all in the status file.
- When OFF: paid requests return 403 with a stable error code (e.g. `PAID_BOOKINGS_DISABLED`); free bookings (total 0, no order) keep working unchanged. Webhook/verify/refund routes stay working (they settle existing payments).
- Organiser event create/edit: when OFF, reject a ticket price > 0 on the server (and the UI should explain: "Paid tickets are coming soon — publish as a free event for now"). Same for any paid venue-booking flow.

## 3. UI
- Public event page / checkout of an existing paid event when OFF: no Pay button; show a neutral "Booking opens soon" state (one dictionary key, en + the other 11 locales one file per call).
- Admin: a toggle in `/dashboard/admin/settings` (Settings page) next to the fee settings, design tokens only, with a one-line warning ("Turns on real payments. Needs Razorpay live keys + GST/compliance sign-off.").

## Tests (T1)
- Unit: guard returns/throws correctly for on/off; free total never blocked.
- e2e/integration: with the setting OFF, POST to create-order for a paid booking → 403 `PAID_BOOKINGS_DISABLED`, and a free booking still succeeds. Do NOT flip the global QA setting inside parallel e2e runs; test the route logic with the setting injected/mocked, or via a unit-level call. If you need an e2e for the UI state, render with the flag injected rather than mutating the DB.
- Regression shape: the OFF assertion fails on origin/qa (no guard) and passes on the branch.
- tsc, unit self-tests, eslint (touched files), design-tokens checker/ratchet green.

## Finish
Status file `cc-autopilot-status.md` (T7): every money path found + guarded, migration file name, before/after, pushed head, and Human check (Hitesh: admin toggle visible; with it OFF on a preview, a paid event shows "Booking opens soon"). Do not touch the Feedback table or any DB.
