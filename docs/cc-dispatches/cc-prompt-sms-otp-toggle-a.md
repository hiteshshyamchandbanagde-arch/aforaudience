# CC dispatch A: SMS OTP on/off admin setting (server + sign-up/login)

> **Branch off `origin/qa`: `feat/sms-otp-toggle`.** Small chunks, commit + push after each. 45-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** Never write the QA `PlatformSettings` row (chat sets it). One locale file per tool call. No skip/fixme, no loosened tests.

## Decision (Hitesh, 17 Nov)
Prod launches **without MSG91** (no DLT yet). SMS OTP becomes an **admin setting**, off on prod, so it can be switched on later without a deploy once the MSG91 keys + DLT are ready. This replaces Part 78's "(a) MSG91 first".

## The rule
New `PlatformSettings.smsOtpEnabled Boolean @default(false)` (migration `20261117130000_sms_otp_toggle`, ADD COLUMN only; like `paidBookingsEnabled`/waves, the migration never sets it true). Chat sets QA's row to **true** after applying it, so QA keeps testing the full OTP flow on the mock provider.

- **ON** = today's behaviour exactly. Nothing changes.
- **OFF**:
  - No SMS is ever sent; `/api/auth/otp/request` returns 404/disabled for every purpose.
  - Sign-up skips the OTP stage. Phone is **optional** (if given: same +91/10-digit validation and uniqueness). The user is signed in straight away (credentials) and continues to onboarding as after a successful OTP today.
  - Login hides "Login with OTP" (password + Google only).
  - **The phone gate is waived**: an unverified user can do everything a verified one can. `isVerified` keeps its meaning (phone verified) and is never set true without an OTP.
  - No replacement gate (no email-verification requirement): email isn't set up on prod yet, and Google accounts are already email-verified.

## A — this dispatch (server + auth)
1. Migration + schema + `getPlatformSettings()` type; setter `setSmsOtpEnabled(enabled)` in `src/lib/platform-settings.ts` (same shape as `setPaidBookingsEnabled`).
2. One helper (e.g. `src/lib/phone-gate.ts`): `phoneVerificationRequired(settings)` and `needsPhoneVerification(user, settings)` = `settings.smsOtpEnabled && !user.isVerified`. Route **every** server gate through it:
   - `requireVerifiedPhone` callers (8): venue-booking-requests/[id], events POST, events/[id], performances/[id]/plus-ones, venues POST, venues/[id], applications, organiser/payout-account
   - the inline checks in `api/bookings/route.ts:71` and `api/venue-bookings/route.ts:20`
3. `/api/auth/otp/request` + `/api/auth/otp/verify`: disabled when OFF. `register` route: when OFF, no `generateAndSendOtp`, phone optional, response tells the client to sign in directly (no `devOtp`).
4. Session (`src/lib/auth.ts` session callback, which already refreshes from the DB): expose `session.user.needsPhoneVerification` (computed with the helper). Leave `isVerified` as is. The client side comes in dispatch B.
5. `RegisterForm.tsx` + `login/page.tsx`: OFF behaviour above. They need the flag before submit: read it from the existing public settings path or add a tiny `GET /api/auth/sms-otp` → `{ enabled }` (no auth, cached like the other settings reads).

## Tests (T1), this dispatch
- Unit: helper truth table; **source guard** that no route under `src/app/api` reads `user.isVerified` / `requireVerifiedPhone` except through the helper (fails on `origin/qa`).
- Unit/API: the register handler in both modes (OFF: no OTP call, phone optional, user created; ON: unchanged), and otp/request in both modes. Mock the settings read; don't write the QA row.
- e2e: existing OTP specs must stay green unchanged (QA = ON). Don't flip the global setting inside e2e: it races the other shards. OFF-mode UI is covered by unit tests + a Human check.
- tsc, eslint (touched files), design-tokens green.

## Finish
Status file: what's done, test before/after, pushed head, and anything left for B. **Note for chat:** apply the migration on QA, then `UPDATE "PlatformSettings" SET "smsOtpEnabled" = true WHERE id = 'singleton'` **before** the PR's e2e-preview runs.
