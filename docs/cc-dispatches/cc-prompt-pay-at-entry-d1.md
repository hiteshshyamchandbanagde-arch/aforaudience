# CC dispatch: run D1, audience "Pay at entry" + attendance tracking (Hitesh 8 Nov)

> **New branch `feat/pay-at-entry-d1` off `origin/qa`** — requires #767 (S1a paid switch) merged; if `src/lib/paid-bookings.ts` is missing on origin/qa, stop and say so. Small chunks: one edit, commit, push, next; one dictionary file per call. 45-min limit: if not finished, push a working part and list what's left. Chat merges and applies migrations. **Never `git stash pop` on a clean tree.**

## Decisions (Hitesh, 8 Nov)
- Soft launch = no money through AFA. For priced shows, the audience **reserves on AFA and pays the organiser directly at the venue (cash/UPI)**. This works even while `paidBookingsEnabled` (online payments) is OFF.
- Default audience mode = **Pay at entry**: the seat is reserved instantly (capacity-limited), no approval step.
- **Attendance is tracked per booking**: Reserved → Attended / No-show (and Cancelled).
- AFA never shows its own UPI/QR and never collects; the payee is always named.
- **Razorpay online payments must stay fully working and switchable (Hitesh, 8 Nov 17:00: "keep our Razorpay option switchable at configuration, if needed tomorrow").** Do not remove, weaken or refactor the existing online checkout / Razorpay order / verify / webhook / refund paths. With `paidBookingsEnabled` ON, an ONLINE event must behave exactly as today (existing paid e2e specs must stay green unchanged); with it OFF, only online money is blocked. Turning it on later must need no code change — only the admin toggle (plus live keys in env).

## 1. Data (one additive migration file; chat applies to QA)
- `Event.paymentMode` enum `EventPaymentMode { FREE, PAY_AT_ENTRY, ONLINE }`, default derived for existing rows: free events → FREE, priced → ONLINE (backfill in the same migration with a WHERE on the existing free/price fields — read the schema for the real field names). New priced events created while online payments are OFF default to PAY_AT_ENTRY.
- `Booking.attendance` enum `AttendanceStatus { RESERVED, ATTENDED, NO_SHOW }` default RESERVED (keep `status` BookingStatus as is: a pay-at-entry booking is CONFIRMED with `totalAmount` = price shown but `paymentId` null and a new `paymentMethod` enum `{ ONLINE, AT_ENTRY, NONE }`).
- Keep it additive (ADD COLUMN … DEFAULT …), IF NOT EXISTS where Postgres allows; enum types created idempotently.

## 2. Server
- Booking create (`POST /api/bookings`): if event.paymentMode = PAY_AT_ENTRY → create a CONFIRMED booking, paymentMethod AT_ENTRY, **no Razorpay order**, no booking fee (bookingFeeAmount 0), ticket issued like free tickets. Must NOT be blocked by the S1a switch (S1a guards online money only) — add a unit test proving both: ONLINE+switch OFF → 403; PAY_AT_ENTRY+switch OFF → 201.
- Max **4 seats per booking** for PAY_AT_ENTRY (server-enforced, clear error).
- Event create/edit: organiser picks Free / Pay at entry (price required) / Online (only selectable when the switch is ON). S1a's "paid price rejected when OFF" must allow price > 0 for PAY_AT_ENTRY.
- Check-in (existing organiser check-in route, sets `checkedInAt`): also set attendance ATTENDED. Add an organiser action "Mark no-show" per booking (allowed from event start until 48 h after), and an automatic pass: bookings still RESERVED 24 h after the event's end → NO_SHOW (put it in the existing cron/scheduled route if there is one; if not, compute lazily on read and say so).

## 3. UI (design tokens only; i18n 12 locales, one file per call)
- Event page / ticket for PAY_AT_ENTRY: price shown as "₹300 · pay [Organiser name] at entry (cash/UPI)", and a line "AforAudience does not collect this payment." Button = "Reserve" (not "Pay").
- My Tickets: badge "Pay at entry · ₹X" and attendance state after the event (Attended / No-show).
- Organiser check-in / guest list: per booking show amount due at entry, attendance state, actions Check in (= Attended) and Mark no-show; counts at top (Reserved / Attended / No-show).

## Tests (T1)
- Unit: mode/switch matrix above; 4-seat cap; auto-no-show rule.
- e2e (QA personas Omkar organiser, Atul audience; clean up after, T6): create a PAY_AT_ENTRY event → Atul reserves 2 seats → ticket shows "pay at entry" and no Pay button → Omkar checks in → Attended; second booking marked No-show. Screenshots 390/1440 for the event page CTA and the guest list.
- Regression shape: fails on origin/qa, passes on the branch. tsc, unit self-tests, eslint (touched), design-tokens checker green.

## Finish
Status file (T7): migration file name, everything changed, before/after, CI link, Human check for Hitesh (reserve a pay-at-entry show on phone; organiser guest list on phone). Not in scope: venue/artist direct-payment flows (D2/D3), legal page text (D4), reminders. Do not touch the Feedback table or any DB.
