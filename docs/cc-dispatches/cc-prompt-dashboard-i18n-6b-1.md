# CC dispatch 6b-1: Organiser dashboard i18n, first half (GEN-2610-007)

> **Existing branch `feat/dashboard-i18n-6b`** (head `2e839c6`: Organiser specs already switched to `data-afa-*` hooks, CI green). FIRST rebase onto `origin/qa`. Never merge, never merge-commit. Push after EVERY commit. Chat merges. Autopilot. Do not edit `.github/workflows/`. QA DB only. Full brief: `docs/cc-dispatches/cc-prompt-dashboard-i18n-6b.md`; pattern: PR #748 (6a).
> **Why this is split:** the last runs on this ticket ended 7-21 min in with `is_error` while writing translations. Keep every edit SMALL: add the English keys for one page, commit+push; then add ONE locale file's translations for that page, commit+push; repeat per locale. Never edit more than one dictionary file in a single tool call. Never rewrite a whole dictionary file.

**FIRST ACTION:** status file `RESULT: PARTIAL feat/dashboard-i18n-6b none`.

**Scope of this run only:** the Organiser **Your Events list, event detail (incl. Artist Applications and compensation override), Create Event and Edit Event** pages (and `eventTermsChecklist` use there). Namespace `organiserDashboard` with one sub-object per page. Order: English keys + page wiring for one page -> 11 locales one file at a time -> next page.

Leave Sales, Requests, check-in, tours, payouts and edit profile for 6b-2. Add the e2e checks for the pages done in this run to `e2e/dashboard-i18n-organiser.spec.ts` (hi at 390 + 1440, mr and de spot checks) and extend `scripts/i18n-untranslated.test.ts` to the new namespace.

Status file: `RESULT: PUSHED feat/dashboard-i18n-6b <sha>`, pages done, string counts, TODO i18n list, tests, e2e-preview result if it finishes.
