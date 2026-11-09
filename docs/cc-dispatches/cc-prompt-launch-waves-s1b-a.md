# CC dispatch: run S1b-a — launch wave flags W1–W4: data + server gates (+ language-rollout flake)

> **New branch `feat/launch-waves-s1b-a` off `origin/qa`.** Small chunks, commit + push after each. 45-min limit (push a working part, list what's left). **Commit nothing named cc-autopilot-status.md; write it per the workflow.** Chat applies the migration and merges. **Never `git stash pop` on a clean tree.** UI is NOT in scope (that's S1b-b) — server, lib, migration, tests only.

## Decision (Hitesh, 9 Nov — Part 68 §5.1)
Go-live is staged by four admin switches on `PlatformSettings`. Prod default **all OFF**; admin turns them on one at a time. Same pattern as S1a `paidBookingsEnabled` (`src/lib/paid-bookings.ts` + `src/lib/platform-settings.ts`) — copy its shape.

| Flag (column) | Wave | When OFF, refuse… |
|---|---|---|
| `waveDiscoveryOpen` | W1 discovery + signup | **new accounts**: `POST /api/auth/register`, any OTP path that *creates* a user, and the Google `adapter.createUser` in `src/lib/auth.ts`. Existing users still sign in. (The public holding page is S1b-b.) |
| `waveOnboardingOpen` | W2 organiser / venue / artist onboarding | `POST` on `/api/organisers/apply`, `/api/venue-owners/apply`, `/api/artists/apply`. Admin approve/reject untouched. |
| `waveTicketsOpen` | W3 free + pay-at-entry tickets | `POST /api/bookings` (new audience reservations). Existing bookings, ticket download, check-in, attendance, cancel/refund untouched. |
| `waveDirectBookingsOpen` | W4 direct-payment B2B | **creating** a venue booking / venue booking request with amount > 0, and **creating** a PAID or BUY_IN performance (invite-artist, applications, lineup, tour-lineup — read them, find every create path). FREE lineup slots and zero-amount venue bookings are W2, not W4 (so W2 events can still be built). **Never** block a step on an in-flight booking (accept/decline/I've paid/confirm/cancel/expiry). |

Rules for every gate:
- **ADMIN role always bypasses** (admin must be able to test on prod with waves closed).
- Refusal = `403 { error, code: "WAVE_CLOSED", wave: "W1"|"W2"|"W3"|"W4" }`, friendly message per wave (English only here; S1b-b localises the UI).
- Order: auth → wave gate → existing validation. Gate before any DB write.
- Do not change `paidBookingsEnabled` behaviour or any Razorpay path.

## Read first
`src/lib/paid-bookings.ts`, `src/lib/platform-settings.ts`, `src/app/api/admin/platform-settings/route.ts`, `src/app/api/platform-settings/paid-bookings/route.ts`, `prisma/schema.prisma` (PlatformSettings), `prisma/migrations/20261108120000_add_paid_bookings_enabled/`, the routes in the table, `src/lib/auth.ts` (adapter.createUser), `src/app/api/auth/otp/**`, `e2e/admin-paid-bookings.spec.ts`.

## Do (one commit each)
1. **Migration** `prisma/migrations/20261111120000_add_launch_waves/migration.sql`: four `BOOLEAN NOT NULL DEFAULT false` columns on `PlatformSettings` + schema.prisma. Additive only. Chat applies to QA and sets the QA row all-true (so QA behaves as today).
2. **Lib** `src/lib/launch-waves.ts` (no Prisma import, like paid-bookings.ts): `Wave` type, flag-key map, `isWaveOpen(settings, wave)`, `waveBlock(wave, open, isAdmin)` → null | 403 body, `WaveClosedError`. DB read in platform-settings.ts: add the four to the type + `SETTINGS_SELECT`, plus `getLaunchWaves()`.
3. **Admin settings API**: accept the four as optional booleans (reject non-boolean with 400, nothing written — same as S1a). **Read hint** `GET /api/platform-settings/launch-waves` → `{ W1, W2, W3, W4 }` booleans (public, read-only, for S1b-b).
4. **Gates** W1 → W2 → W3 → W4, one commit per wave.
5. **Flake** `e2e/language-rollout.spec.ts:108` (switcher, failed on kn, earlier bn/gu): find the root cause (likely the switch racing hydration / the menu not open yet — wait on a real signal, not a timeout) and fix it. If no root cause in 15 min: `test.fixme` that case only with a one-line reason + report it; chat files the Feedback ticket.

## Tests (T1)
- **Unit self-tests** for launch-waves.ts: each wave open/closed, admin bypass, W4 amount>0 vs 0, FREE vs PAID/BUY_IN. Route-level: each gated route returns 403 WAVE_CLOSED when its flag is off (inject settings; **never write the QA PlatformSettings row**), and is unchanged when on.
- **Regression shape:** the new unit tests fail on origin/qa (no lib), pass on the branch.
- **e2e:** `e2e/admin-launch-waves.spec.ts` — read hint returns 4 booleans; admin settings API rejects a non-boolean wave flag (nothing written). Read the row, never write it.
- Existing booking / apply / venue-booking / lineup / auth specs stay green **unchanged** (QA row is all-true). Run only touched specs locally (+ `language-rollout.spec.ts` ×3 for the flake).
- tsc, unit self-tests, eslint (touched files), design-tokens green.

## Finish
Status file (T7): migration name + SQL, every gated route (file:line), anything you found that creates a user/booking/performance and is NOT gated (and why), flake root cause or fixme, before/after, pushed head. Human check: none (no UI). Do not touch the Feedback table or any DB.
