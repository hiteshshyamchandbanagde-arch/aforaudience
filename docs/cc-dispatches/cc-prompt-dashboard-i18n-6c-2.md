# CC dispatch 6c-2: Venue Owner dashboard i18n, second half (GEN-2610-007)

> **Existing branch `feat/dashboard-i18n-6c`** (head `3561fea`: 6c-1 done — My Venues, venue page, venue form, Edit Venue, Seat Map Builder). FIRST rebase onto `origin/qa`. **Small-chunk rule (AGENTS.md):** one small edit, commit, push; one dictionary file per commit. Chat merges. Autopilot. Do not edit `.github/workflows/`. QA DB only. Pattern: 6b and 6c-1 commits.

**FIRST ACTION:** status file `RESULT: PARTIAL feat/dashboard-i18n-6c none`. If a previous run already landed some of this scope (check `git log`), continue from the next file; do not redo.

**Scope:** `src/app/dashboard/venue/bookings` (incl. calendar, Pending, Past Requests), `src/app/dashboard/venue/sales`, `src/app/dashboard/venue/create`, `src/app/dashboard/venue-requests`, the Venue Owner Edit Profile page and the Venue Owner More sheet items, plus any remaining venue-only toasts/empty states. Hooks before translation for any spec that finds this UI by English text. Extend `e2e/dashboard-i18n-venue.spec.ts` (hi at 390 + 1440, mr/de spot checks) and keep `scripts/i18n-untranslated.test.ts` green. Full local e2e before the last push.

Status file: `RESULT: PUSHED feat/dashboard-i18n-6c <sha>`, pages done, string counts, specs switched to hooks, TODO i18n list, e2e-preview result, and the **Human check** (Hitesh reads the Venue Owner dashboard in Hindi and Marathi as Vinayak).
