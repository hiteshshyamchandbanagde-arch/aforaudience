# CC dispatch 6b-2: Organiser dashboard i18n, second half (GEN-2610-007)

> **Existing branch `feat/dashboard-i18n-6b`** (head `35a78dc`: 6b-1 done — Your Events, event detail, Create/Edit Event, 262 keys x 11 locales). FIRST rebase onto `origin/qa`. Never merge, never merge-commit. **Small-chunk rule (AGENTS.md):** one small edit, commit, push; one dictionary file per edit. Chat merges. Autopilot. Do not edit `.github/workflows/`. QA DB only. Pattern: PR #748 and the 6b-1 commits.

**FIRST ACTION:** status file `RESULT: PARTIAL feat/dashboard-i18n-6b none`. Then check e2e-preview on `35a78dc` (`gh api repos/{owner}/{repo}/commits/35a78dc/check-runs`); if it is red, fix that first (cause, not loosening) and push.

**Scope of this run:** the rest of `src/app/dashboard/organiser/**`: Sales Overview, Venue Booking Requests (organiser side), check-in, tours, payouts, edit profile, and any remaining organiser-only components, empty/error states and toasts. Same order as 6b-1: English keys + wiring for one page -> 11 locales one file at a time -> next page. Extend `e2e/dashboard-i18n-organiser.spec.ts` with these pages (hi at 390 + 1440, mr and de spot checks) and keep `scripts/i18n-untranslated.test.ts` green. Then a full local e2e before the last push.

Status file: `RESULT: PUSHED feat/dashboard-i18n-6b <sha>`, pages done, string counts, TODO i18n list, tests, e2e-preview result, and the **Human check** (Hitesh reads the Organiser dashboard in Hindi and Marathi as Omkar).
