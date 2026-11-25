# CC dispatch 6c-1b: finish Venue Owner first half (GEN-2610-007)

> **Existing branch `feat/dashboard-i18n-6c`** (head `dfd2b8e`; e2e-preview green 438/0). FIRST rebase onto `origin/qa`. **Small-chunk rule (AGENTS.md).** Chat merges. Autopilot. Do not edit `.github/workflows/`. QA DB only. Brief: `docs/cc-dispatches/cc-prompt-dashboard-i18n-6c-1.md`.
> The previous run (37987384463) ended ~15 min in with `is_error` while doing Edit Venue locales. Check `git log` to see exactly which locale commits landed and continue from the next one; do not redo finished files.

**FIRST ACTION:** status file `RESULT: PARTIAL feat/dashboard-i18n-6c none`.

**Scope of this run only:** (1) finish Edit Venue for the locales not yet committed, (2) the Seat Map Builder (draft/restore dialogs, freeze banner, level/seat labels), one locale file per commit, (3) add these pages to `e2e/dashboard-i18n-venue.spec.ts` (create it if missing; Vinayak, hi at 390 + 1440, mr/de spot checks) and keep `scripts/i18n-untranslated.test.ts` green. Stop there and push; 6c-2 does Bookings, Sales, Requests, venue-requests, Edit Profile.

Status file: `RESULT: PUSHED feat/dashboard-i18n-6c <sha>`, pages done, which locales were picked up from the previous run, tests, e2e-preview result if it finishes.
