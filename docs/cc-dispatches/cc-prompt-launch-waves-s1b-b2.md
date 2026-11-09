# CC dispatch: run S1b-b2 — launch waves UI part 2: W2/W3/W4 "opening soon" states

> **New branch `feat/launch-waves-s1b-b2` off `origin/feat/launch-waves-s1b-b1`.** If origin/qa already contains S1b-b1 (`holdingPageApplies` in `src/lib/launch-waves.ts`), branch off `origin/qa` instead. Small chunks, commit + push after each; **one dictionary file per call**. 45-min limit (push a working part, list what's left). **Commit nothing named cc-autopilot-status.md; write it per the workflow.** Never `git stash pop` on a clean tree. No DB changes.

## Context
S1b-a: server gates + `GET /api/platform-settings/launch-waves` → `{W1..W4}`; refusals are `403 {code:"WAVE_CLOSED", wave}`; ADMIN bypasses. S1b-b1: admin toggles, W1 holding page, sign-up messages. **This dispatch: the remaining user-facing states so nobody hits a raw 403.** Copy the pattern of the existing paid-bookings "Booking opens soon" state (`src/app/(public)/events/[id]/page.tsx` ~l.163, `seats/page.tsx` ~l.27) — read it first; reuse its look.

## Do (one commit each)
1. **Shared read**: a tiny server helper (event pages etc. are server components — prefer `getLaunchWaves()` server-side) and, only where a client component needs it, a hook reading the hint endpoint. Admin viewers see everything open (bypass) — match the server.
2. **W2 closed**: "Become an organiser / venue owner / artist" entry points (start at `src/app/profile/page.tsx`; find the rest, incl. any dashboard/landing CTAs and `/for-artists`) show a disabled "Applications open soon" state instead of the form/button.
3. **W3 closed**: event detail Reserve/Book button (and the seats page) show "Tickets open soon" instead; the server already refuses. If paid-bookings-off and W3-closed both apply, show the W3 message (it's the broader one). Free and pay-at-entry alike.
4. **W4 closed**: organiser event create/edit (`src/app/dashboard/organiser/events/create`, `[id]/edit`) — attaching a venue with a booking amount > 0 shows an inline "Paid venue bookings open soon — zero-amount venue bookings are allowed" note and blocks submit of that combination; the invite-artist / tour-lineup / artist-profile invite controls (`src/app/dashboard/organiser/events/[id]/edit/page.tsx`, `src/app/dashboard/organiser/tours/[id]/page.tsx`, `src/app/(public)/artists/[id]/ArtistProfileClientPage.tsx`) disable PAID and BUY_IN with "Paid artist slots open soon"; FREE stays selectable. Application approve for a PAID/BUY_IN application: friendly message, not a raw error.
5. **Client 403 mapping**: one helper that turns `{code:"WAVE_CLOSED", wave}` into the localized wave message; use it in every fetch above (and the existing bookings / venue-booking / invite error paths), so a stale page still shows a friendly line.
6. **i18n**: all new strings through `tr` in all 12 dictionaries, **one file per call**, `en` first.

## Tests (T1)
- Self-tests for the 403 → message helper (each wave, unknown code passthrough) and any pure "is this control blocked" helper. They fail on the base, pass on the branch.
- e2e `e2e/launch-waves-states.spec.ts`: with `page.route` on `/api/platform-settings/launch-waves` (client hint) and on the action endpoints returning `403 WAVE_CLOSED`, assert each friendly message (W2 apply, W3 reserve error path, W4 invite PAID disabled / FREE enabled, W4 paid venue note). For server-rendered states that can't be intercepted, cover the decision with self-tests and say so. **Never write the QA PlatformSettings row.** With QA all-open, existing booking / apply / lineup / venue-booking specs stay green **unchanged**.
- Latin-leak specs for hi + mr on the touched pages. Screenshots 390 + 1440 of each state you can reach via interception.
- tsc, self-tests, eslint (touched), design-tokens green. Run only touched specs locally.

## Finish
Status file (T7): every control changed (file:line), anything you found that still surfaces a raw WAVE_CLOSED, before/after, pushed head. Human check (Hitesh): one state per wave on phone once chat flips that wave off on QA for a few minutes with his OK. Do not touch the Feedback table or any DB.
