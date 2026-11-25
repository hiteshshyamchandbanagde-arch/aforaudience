# CC dispatch: run D2, Organiser → Venue owner bookings with DIRECT payment (Hitesh 8 Nov)

> **New branch `feat/venue-direct-pay-d2` off `origin/qa`** (after #768 D1 is merged; if `src/lib/pay-at-entry.ts` is missing on origin/qa, stop and say so). Small chunks: one edit, commit, push; one dictionary file per call. 45-min limit: push a working part and list what's left if needed. Chat merges and applies migrations. **Never `git stash pop` on a clean tree.**

## Decision (Hitesh, 8 Nov)
One flow for business bookings, AFA never touches money:
**Request → Venue owner accepts (shows their own UPI ID / QR + amount, payee named) → Organiser pays directly (cash/UPI) and taps "I've paid" (+ optional UPI reference) → Venue owner confirms receipt → Booking CONFIRMED.** Plus Decline, Cancel (either side, before confirm), and **Expire after 48 h** at any waiting step (releases the slot).
Every payment screen: "Pay [venue/owner name] directly. AforAudience does not collect or hold this payment." AFA never shows its own UPI/QR.
**No AFA platform fee on direct-payment venue bookings** (today's flow snapshots `platformFeeAmount` ₹199 — set 0 for direct bookings; leave the online path as is). **Razorpay stays switchable:** do not change online venue checkout / wallet / payment code; when `paidBookingsEnabled` is ON the existing online path must still work exactly as today.

## Read first
`prisma/schema.prisma` (VenueBooking, VenueBookingRequest, VenueBookingOffer, Venue, VenueOwner), `src/app/api/venue-bookings/route.ts` + `[id]/*`, `src/app/api/venue-booking-requests/**` (fixed-rate path and negotiated/Flexible path both end in a CONFIRMED VenueBooking today), the venue owner + organiser dashboard pages that list these, `src/lib/paid-bookings.ts`, `src/lib/pay-at-entry.ts`, `docs/design.md`.

## Do
1. **Data (one additive migration; chat applies to QA):** VenueOwner (or Venue — pick where payout identity lives and say why) gets `upiId String?` and optional `upiQrUrl String?`. VenueBooking gets the direct-payment state: either new BookingStatus-like enum `DirectPayStatus { AWAITING_PAYMENT, PAID_MARKED, CONFIRMED }` + `paymentMethod` (reuse `BookingPaymentMethod` from D1: DIRECT = add value `DIRECT` idempotently) + `paidMarkedAt`, `payerReference String?`, `confirmedAt`, `expiresAt`. Additive only, idempotent enum changes, defaults that keep every existing row valid.
2. **Server:** when online payments are OFF (or the venue owner chose direct), the accept step (fixed-rate owner accept AND negotiated offer accept) creates the booking in AWAITING_PAYMENT with `expiresAt = now + 48h`, platform fee 0, and requires the owner to have a UPI ID (or allow "cash only" with a clear note). Endpoints: organiser "I've paid" (+reference) → PAID_MARKED; owner "Confirm payment received" → CONFIRMED (+ existing side effects that today happen on confirm, e.g. linked Event PENDING_APPROVAL → APPROVED — move them to this step); decline/cancel; lazy + cron expiry (reuse the existing 48 h expiry pattern in venue-booking-requests). Authorisation: only the right party can do each step.
3. **UI (design tokens only; 12 locales one file per call):** venue owner profile settings: UPI ID (+ optional QR upload if an upload helper already exists; else UPI ID only). Owner and organiser booking views: clear status chips (Requested / Accepted – awaiting payment / Payment marked / Confirmed / Declined / Expired / Cancelled), the payee block with UPI ID (copy button) and amount, and the right action button for each side. Notifications: reuse the existing notification/pending-count mechanism for each step.

## Tests (T1)
- Unit: state machine (allowed transitions, who may act, expiry at 48 h, fee 0 for direct).
- e2e (QA personas Omkar organiser + Vinayak venue owner; clean up after, T6): request → accept (shows Vinayak's UPI) → Omkar "I've paid" → Vinayak confirms → CONFIRMED; plus one decline. Screenshots 390/1440 of the payee block. Use the flag-injection pattern from D1 for switch state; don't flip the global QA setting.
- Regression shape: fails on origin/qa, passes on the branch. tsc, unit self-tests, eslint (touched), design-tokens green. Existing venue-booking e2e specs must stay green unchanged (or each change justified in the status file).

## Finish
Status file (T7): migration file name + what it does, every endpoint/state, before/after, Human check (Hitesh on phone: as Omkar request Vinayak's hall, as Vinayak accept + see UPI shown, mark paid, confirm). Not in scope: artist bookings (D3), legal text (D4). Do not touch the Feedback table or any DB.
