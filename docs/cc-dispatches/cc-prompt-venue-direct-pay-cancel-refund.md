# CC dispatch: venue direct-pay, cancel after CONFIRMED + refund tracking (Part 71 Next #2, venue half)

> **Branch off `origin/qa`: `feat/venue-direct-pay-cancel-refund`.** Small chunks, commit + push after each. 60-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** Never write the QA `PlatformSettings` row. The artist (D3, `Performance`) half is a separate dispatch. Don't touch `performance-direct-pay*` here.

## Why
The 12 Nov refund decision (`/refund-policy` §3, §6, `src/lib/direct-pay-terms.ts`) says venue bookings can be cancelled from the dashboard, with the 15-day standard term. Today `directPayTransition` only allows `cancel` before CONFIRMED (`src/lib/venue-direct-pay.ts`). AFA never moves money. It only records who cancelled, when, and whether a refund is due, and the payer confirms receipt.

## DB: ALREADY APPLIED ON QA by chat (do not run it, and do not run `prisma migrate dev`)
Migration `20261112120000_add_direct_pay_refund_tracking`. Commit this exact SQL as `prisma/migrations/20261112120000_add_direct_pay_refund_tracking/migration.sql` and mirror it in `schema.prisma`:
```sql
CREATE TYPE "DirectRefundStatus" AS ENUM ('DUE', 'AS_AGREED', 'RECEIVED');
CREATE TYPE "DirectPayParty" AS ENUM ('ORGANISER', 'VENUE_OWNER', 'ARTIST');
ALTER TABLE "VenueBooking"
  ADD COLUMN "directRefundStatus" "DirectRefundStatus",
  ADD COLUMN "cancelledBy" "DirectPayParty",
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "refundReceivedAt" TIMESTAMP(3);
```
The first commit should be the schema + migration file only, then `prisma generate` and tsc green.

## Behaviour
1. **New pure helper** (in `venue-direct-pay.ts`, no Prisma): `cancelConfirmedOutcome(fromDate, now, advancePaid)` → `DUE` when `fromDate - now ≥ DIRECT_PAY_FULL_REFUND_MIN_DAYS` days **and** an advance was paid; `AS_AGREED` when inside the window and an advance was paid; `null` when nothing was paid. Before cutting the definition of "advance paid" to `confirmedAt != null` (CONFIRMED means the owner confirmed receipt), check that `paidMarkedAt`/`confirmedAt` really mean this. Use calendar-day maths in IST, and unit-test the boundary (exactly 15 days = DUE; 14 days 23 h = AS_AGREED).
2. **State machine:** a new action `cancelConfirmed`. Either side may use it from `CONFIRMED` only, and only before `fromDate` (past/started bookings are refused with 400). It goes to `directPayStatus: CANCELLED`, booking `status: CANCELLED`, and sets `cancelledBy`, `cancelledAt` and `directRefundStatus` from the helper. The existing pre-confirm `cancel` also records `cancelledBy` and `cancelledAt` (refund status stays null, since nothing was paid).
3. **A new action `refundReceived`:** ORGANISER only (the payer), from `directRefundStatus` `DUE` or `AS_AGREED` → `RECEIVED`, setting `refundReceivedAt`. Other roles get 403, and a second tap gets 400.
4. **API:** extend `POST /api/venue-bookings/[id]/direct-pay` (`ACTIONS`) with both actions, using the same auth/side checks as today. On `cancelConfirmed`, run the same event-slot release and notifications as the existing cancel path (lines ~99–132). The notification body states the outcome: "Refund of the ₹{amount} advance is due under the 15-day term" / "Cancelled inside 15 days: any refund is as you both agree". When marked received, notify the venue owner.
5. **UI** (`DirectPayBookings.tsx`, both sides, plus the venue owner's bookings list if it renders these):
   - CONFIRMED and upcoming: a **Cancel booking** button behind the existing `ConfirmDialog`. The dialog states the outcome before confirming, using the same helper.
   - Cancelled with a refund status: a status chip ("Refund due" / "Refund as agreed" / "Refund received ✓" with its date), plus who cancelled and when.
   - The organiser sees **"I've received the refund"** while the status is DUE or AS_AGREED.
   - All strings are new i18n keys, English first, then the other 11 locales **one file per call**.
   - Tokens only. `--afa-fill-solid` is reserved for commit actions: Cancel booking is destructive, so use the existing danger/neutral button style as other cancels do.
6. **Not in scope:** the late-cancel count on profiles, admin views, and the artist/Performance half.

## Tests (T1)
- Unit (`scripts/*.test.ts`, existing pattern): the helper's boundaries; the transition table (who can do what from which status, including 403/400 cases).
- e2e (extend `e2e/venue-direct-pay.spec.ts` using its fixtures, `@needs-db`, restore state after):
  - organiser cancels a CONFIRMED booking ≥15 days out → "Refund due" for both sides, then "I've received the refund" → "Refund received";
  - inside 15 days → "Refund as agreed";
  - the venue owner can't mark the refund received (API 403).
  - Add screenshots at 390/1440 of the chip and the dialog.
  - These must fail on `origin/qa` and pass on the branch. Report both results.
- Run locally only the specs you touched. tsc, eslint (touched files) and design-tokens must be green.

## Finish
Status file: chunks done, the definition of "advance paid" you settled on (with a code reference), tests fail→pass, baselines, and the pushed head. Human check: on a phone, cancel a confirmed venue booking as Omkar and read the dialog and chip copy, including hi/mr. Don't touch the Feedback table.
