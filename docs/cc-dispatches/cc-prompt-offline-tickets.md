# CC dispatch: offline tickets + screenshot flake (BUG-2610-001, BUG-2610-033)

> **New branch `fix/offline-tickets` off `origin/qa`** (qa @ bd190d9). Small-chunk rule (AGENTS.md): one small edit at a time, commit + push after EVERY commit, ticket ID in each message. **Hard stop at 45 min**: push what is done, write the status file, say what is left. Chat opens the PR and merges. Do not edit `.github/workflows/`. QA DB only, never production (`cncumfwwnjcwacggrgsr`). If origin/qa moves, rebase, never merge. Run the specs you add or touch locally before each push.

**FIRST ACTION:** status file `RESULT: PARTIAL fix/offline-tickets none`. Update it after each step. Read the FULL text of both tickets in the QA Feedback table, plus `docs/testing-rules.md`, `docs/design.md`, `public/sw.js`, `src/lib/sw-cache.ts`, `src/app/tickets/page.tsx` (and whatever it renders), `src/components/pwa/InstallPrompt.tsx`.

## 1. BUG-2610-001 MEDIUM: offline tickets (decided: build it properly, option a)

Today, offline, the SW serves cached /tickets HTML, then the page redirects to /login because the next-auth session fetch fails, and bookings come from /api (never cached, by design). The install prompt promises "offline tickets". Goal: a signed-in user who opened My Tickets once while online can open it at a venue door with no signal and show their QR.

Design (keep it this simple; keep the SW rule that /api is never cached):
- **Client-side snapshot.** When the tickets page loads its bookings online, save a minimal snapshot for the signed-in user only: upcoming + non-cancelled tickets, with just what the door needs (event title, date/time, venue name + city, seat/tier, quantity, booking ref, and the QR payload or an image of it). Key it by userId and include `savedAt`. Use localStorage (or IndexedDB if the QR images make it large), wrapped in try/catch everywhere. No payment details, no other users' data.
- **Offline render.** When the network is down (navigator.onLine false, or the bookings/session fetch fails with a network error, not a 401), do NOT redirect to /login. Render the snapshot instead, with a small banner: offline, showing saved tickets, last updated <savedAt>. If there is no snapshot, show a clear "connect once to save your tickets" state, not a login redirect. A real 401 while online still goes to login as today.
- **QR must render with no network.** Find how the QR is produced today. If it is a server/remote image, generate it client-side from the stored payload (check what is already in package.json before adding anything).
- **Clearing.** Delete the snapshot inside `signOutAndClearCache` and `clearSwRuntimeCacheOnUserChange` (src/lib/sw-cache.ts), so the next person on the device never sees the previous user's tickets. Never show a snapshot whose userId differs from the last signed-in user.
- **Copy.** New strings in all 12 locales (one locale file per edit/commit). Keep "offline tickets" in the install prompt now that it is true.

Tests (T1): unit tests for snapshot save/read/clear (incl. user-change and sign-out clearing, storage throwing). Playwright `e2e/offline-tickets.spec.ts` with a QA persona that has an upcoming ticket (check `e2e/helpers/roles.ts` / seed; create one in setup and remove it in teardown if needed, T6): load /tickets online -> `context.setOffline(true)` -> reload /tickets -> ticket + QR visible, no /login; sign out -> offline /tickets shows no ticket; screenshots at 390 and 1440. Show the spec failing on origin/qa and passing on the branch.

## 2. BUG-2610-033 LOW: 1 px screenshot flake (city-picker-loading / use-my-location)

Find why the height varies by 1 px (sub-pixel layout, font load timing, scrollbar, rounding). Fix the cause (stable size in the page or in the spec's capture region / fonts-ready wait). Do NOT raise the diff threshold or delete the check (T2). Run each affected spec 10x locally and report the pass count.

## Status file

`RESULT: PUSHED fix/offline-tickets <sha>`, per ticket: what changed, tests added, before/after results, what was left if stopped at 45 min, and the **Human check** list (expected: real phone, airplane mode at /tickets after opening it once online; sign out then airplane mode shows nothing; QR scans at check-in).
