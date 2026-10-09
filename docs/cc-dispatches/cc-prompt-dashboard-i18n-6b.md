# CC dispatch 6b: dashboard i18n, part 2 of 3 — Organiser (GEN-2610-007)

> **New branch `feat/dashboard-i18n-6b` off `origin/qa`** (6a merged as #748). Push after EVERY commit (small commits). Chat merges. Autopilot. Budget about 250 turns. Do not edit `.github/workflows/`. QA DB only, never production (`cncumfwwnjcwacggrgsr`). If origin/qa moves, rebase, never merge. Run the specs you add or touch locally before each push.

**FIRST ACTION:** status file `RESULT: PARTIAL feat/dashboard-i18n-6b none`. Read `docs/cc-dispatches/cc-prompt-dashboard-i18n-6a.md` and the 6a code (PR #748: namespaces, `data-afa-*` hooks, `e2e/dashboard-i18n-artist.spec.ts`, `scripts/i18n-untranslated.test.ts`). **Copy that pattern exactly.**

1. **Scope:** every user-visible string under `src/app/dashboard/organiser/**` (≈13 files, 5.4k lines: Your Events, Create/Edit Event incl. `eventTermsChecklist` (use the translated one now), event detail with Artist Applications and compensation override, check-in, tours, Sales Overview, Venue Booking Requests (organiser side), payouts, edit profile, empty/error states, toasts, ConfirmDialog strings) plus organiser-only components they import. One namespace `organiserDashboard` (split sub-objects per page). Admin untouched. Status/enum values stay English in data; only labels translate.
2. **Stable selectors first:** before translating a page, switch every e2e spec that finds Organiser UI by English text to `data-afa-*` hooks (add the hooks in the product), with assertions otherwise unchanged. List the specs you changed and why (T2: changes to existing tests are justified).
3. **Translations:** real translations in all 11 non-English locales (hi and mr with extra care, natural not literal; proper nouns, AFA codes, ₹ amounts unchanged). `// TODO i18n` only where genuinely uncertain, listed. Extend `scripts/i18n-untranslated.test.ts` to the new namespace.
4. **Tests (T1):** `e2e/dashboard-i18n-organiser.spec.ts` (as Omkar): Your Events, an event's detail page, Create Event form, Sales, Requests at 390 and 1440 in hi; spot checks mr and de; no English UI strings (allow-list proper nouns); English baselines unchanged; persona locale back to none.
5. Full local e2e on the branch before the last push.

Status file: `RESULT: PUSHED feat/dashboard-i18n-6b <sha>`, string counts, specs switched to hooks, TODO i18n list, e2e-preview result, **Human check** (Hitesh reads the Organiser dashboard in Hindi and Marathi as Omkar).
