# CC dispatch 6c-1: Venue Owner dashboard i18n, first half (GEN-2610-007, part 3)

> **New branch `feat/dashboard-i18n-6c` off `origin/qa`** (6b merged as #749). **Small-chunk rule (AGENTS.md):** one small edit, commit, push; one dictionary file per edit; never rewrite a whole file. Chat merges. Autopilot. Do not edit `.github/workflows/`. QA DB only, never production. Pattern: PR #748 (6a) and #749 (6b, one locale file per commit).

**FIRST ACTION:** status file `RESULT: PARTIAL feat/dashboard-i18n-6c none`.

1. **Hooks first:** switch any e2e spec that finds Venue Owner UI by English text to `data-afa-*` hooks (add them in the product), assertions otherwise unchanged; list the specs and why.
2. **Scope of this run:** under `src/app/dashboard/venue/**`: My Venues list, venue detail/view, venue edit (incl. register-venue form pieces it shares), and the Seat Map Builder (draft/restore dialogs, freeze banner, level/seat labels). Namespace `venueDashboard` with one sub-object per page. Order per page: English keys + wiring -> 11 locales, one file per commit -> next page. Admin untouched.
3. Start `e2e/dashboard-i18n-venue.spec.ts` (as Vinayak; hi at 390 + 1440, mr and de spot checks) for the pages done; extend `scripts/i18n-untranslated.test.ts` to the namespace. Full local e2e before the last push.

Leave Bookings, Sales, Requests, venue-requests and Edit Profile for 6c-2.

Status file: `RESULT: PUSHED feat/dashboard-i18n-6c <sha>`, pages done, string counts, specs switched to hooks, TODO i18n list, e2e-preview result if it finishes.
