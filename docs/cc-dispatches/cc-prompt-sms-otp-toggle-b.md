# CC dispatch B: SMS OTP toggle (client gates, nudges, admin switch)

> **Continue on `feat/sms-otp-toggle`** (dispatch A is already on it; `git fetch && git checkout feat/sms-otp-toggle && git reset --hard origin/feat/sms-otp-toggle`). Small chunks, commit + push after each. 45-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** Never write the QA `PlatformSettings` row. One locale file per tool call. No skip/fixme, no loosened tests.

Read `cc-prompt-sms-otp-toggle-a.md` first (the rule). Use `session.user.needsPhoneVerification` from A everywhere the client currently looks at `isVerified` for the **phone gate**:

1. Client gates that redirect to `/verify-phone` or block publish: `dashboard/venue/create/page.tsx:267`, `dashboard/organiser/events/create/page.tsx:557`, `dashboard/organiser/events/[id]/edit/page.tsx:537`, `events/[id]/seats/SeatSelectionClientPage.tsx:157`.
2. Nudges: `PhoneVerifyNudge` hidden when OFF; `WelcomeSequence` skips the phone step (step 2) when OFF.
3. `/verify-phone` when OFF: redirect straight to `next` (or `/`).
4. **Not** the phone gate, leave as is: artist profile "verified" badge (`artists/[id]/page.tsx:99`) and homepage stats (`api/stats/homepage`).
5. Admin switch on `/dashboard/admin/settings`: "SMS OTP (phone verification)" on/off, next to the paid-bookings/waves switches, same pattern + API. Helper text: off = sign-up with email/Google only, no phone checks; turn on only after MSG91 keys + DLT are live. Strings in en/hi/mr (one file per call), the other locales as the existing settings strings do.

## Tests (T1)
- Unit: source guard that no client file uses `isVerified` for a phone redirect/block (only `needsPhoneVerification`); fails before this change.
- e2e (QA = ON): existing verify-phone/nudge/welcome specs stay green; add the admin switch to the existing admin-settings spec (render + state at 390/1440). **Don't toggle it in e2e** (global row, races the other shards).
- tsc, eslint (touched files), design-tokens green.

## Finish
Status file: done items, tests, pushed head. Human checks for Hitesh: (1) on prod smoke, with OFF: sign up with email and with Google, no phone step, can reserve a free ticket / publish; (2) on QA, as admin, the switch shows ON and reads well in en/hi/mr.
