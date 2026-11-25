# CC dispatch: run D3, Organiser ↔ Artist performance fees with DIRECT payment (Hitesh 8 Nov)

> **New branch `feat/artist-direct-pay-d3` off `origin/qa`** — requires D2 merged (reuse its `DirectPayStatus` enum, `BookingPaymentMethod.DIRECT`, direct-pay helpers and panel component). If `DirectPayStatus` is missing on origin/qa, stop and say so. Small chunks; one dictionary file per call. 45-min limit (push a working part and list what's left). **Commit nothing named cc-autopilot-status.md; write it per the workflow.** Chat applies migrations and merges. **Never `git stash pop` on a clean tree.**

## Decision (Hitesh, 8 Nov)
Same flow as venue bookings (D2), AFA never touches money: **agreed → payee's UPI/QR + amount shown (payee named; "AforAudience does not collect or hold this payment") → payer pays directly (cash/UPI), taps "I've paid" (+ optional ref) → payee confirms → settled.** Decline/cancel before settle; **48 h expiry** on the payment step. No AFA fee. **Razorpay stays switchable:** do not change any online buy-in/fee payment, refund-status, webhook or Razorpay code; with `paidBookingsEnabled` ON the online path behaves as today.

## Two directions (CompensationType on Performance)
- **PAID** (artist fee): payer = Organiser, payee = Artist (`Performance.feeAmount`).
- **BUY_IN** (open-mic spot fee): payer = Artist, payee = Organiser (`Performance.buyInAmount`).
- **FREE**: nothing to do.

## Read first
`prisma/schema.prisma` (Performance, Application, Artist, Organiser, CompensationType), `src/app/api/applications/**`, `src/app/api/events/[id]/invite-artist`, `/lineup`, `/tour-lineup`, `src/app/api/performances/[id]/**` (cancel, refund-status — find how buy-in/fee is paid online today), D2's direct-pay helpers/panel, `src/lib/paid-bookings.ts`, artist + organiser dashboard pages for gigs/lineup.

## Do
1. **Data (one additive migration; chat applies to QA):** `upiId`/`upiQrUrl` on Artist and on Organiser (nullable; reuse D2's validation + QR upload). Performance gets `paymentMethod` (BookingPaymentMethod, default NONE), `directPayStatus DirectPayStatus?`, `paidMarkedAt`, `payerReference`, `confirmedAt`, `expiresAt` + index. Additive, every existing row valid and unchanged.
2. **Server:** when a PAID or BUY_IN performance is created/approved while online payments are OFF (or the parties choose direct), it enters AWAITING_PAYMENT (48 h) instead of any online step. Step endpoint with who-may-act checks (payer: I've paid / cancel; payee: confirm received / decline), lazy + cron expiry (reuse D2's cron pass). What expiry/cancel does to the lineup slot: release it the same way the existing performance cancel does (read it; reuse, don't duplicate).
3. **UI (design tokens; 12 locales one file per call):** UPI ID (+ optional QR) in artist and organiser profile settings; reuse D2's direct-pay panel in the artist gigs view and the organiser lineup view, with the correct payer/payee per direction and status chips.

## Tests (T1)
- Unit: both directions (who pays whom), transitions, who may act, 48 h expiry, FREE untouched.
- e2e (QA personas Omkar organiser + Hrithik artist; clean up, T6): one PAID gig (Omkar pays Hrithik) and one BUY_IN spot (Hrithik pays Omkar) through to confirmed; screenshots 390/1440 of the payee block. Flag injection for switch state, never flip the global QA setting.
- Regression shape: fails on origin/qa, passes on the branch. Existing lineup/application/performance specs stay green unchanged (or justified). hi/mr Latin checks: "UPI"/"QR" are allowed proper nouns (precedent marathi-locale.spec.ts, D2c).
- tsc, unit self-tests, eslint (touched), design-tokens green.

## Finish
Status file (T7): migration name + content, endpoints/states, before/after, Human check (Hitesh on phone: Omkar invites Hrithik as a paid act → UPI shown to Omkar → I've paid → Hrithik confirms; and a buy-in spot the other way). Not in scope: legal text (D4). Do not touch the Feedback table or any DB.
