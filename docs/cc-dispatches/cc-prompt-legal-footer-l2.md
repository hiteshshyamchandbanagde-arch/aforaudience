# CC dispatch: run L2, footer legal links + company line + delivery clause (Hitesh "yes", 8 Nov)

> **New branch `fix/legal-footer-l2` off `origin/qa`** (after #763 is merged; if `/refund-policy/` or `/contact/` is missing on `origin/qa`, stop and say so in the status file). Small chunks (AGENTS.md): one small edit, commit, push, next. **Never edit more than one dictionary file per tool call.** 45-min hard limit, push after every commit. Push, write the status file, stop. Chat opens the PR and merges. **Never `git stash pop` on a clean tree.**

**Why:** Razorpay's website check of aforaudience.com needs the legal pages linked from the site and the operating company named on it. L1 (#763) built the pages; nothing links Refund or Contact yet, Terms is not in the footer, and the copyright line reads "© 2025 AforAudience. All rights reserved." with no company name.

**Start:** `git fetch && git reset --hard origin/qa`. Read `src/app/HomePageClient.tsx` (footer), `src/lib/i18n/dictionaries/en.ts` (keys `footer*`, around line 1050), `src/app/terms/page.tsx`, `docs/design.md`. Also grep for any other site footer (`footerCopyright`, `footerPrivacyPolicy`) and apply the same change wherever the footer renders.

## 1. Footer (Company column)
- Keep About Us, Blog, Careers, Privacy Policy. Add, in this order after Privacy Policy: **Terms of Service** → `/terms/`, **Refund & Cancellation** → `/refund-policy/`, **Contact Us** → `/contact/`.
- New dictionary keys: `footerTerms`, `footerRefundPolicy`, `footerContact`.
- Copyright: `footerCopyright` becomes "© 2026 Shyamkasturi Productions Private Limited. All rights reserved." and add `footerProductOf`: "AforAudience is a product of Shyamkasturi Productions Private Limited." rendered as a second small line under it. Keep the company name in English (Latin script) in every locale; translate only the surrounding words.
- Design tokens only; the design-tokens check and ratchet must stay green.

## 2. Locale labels (12 dictionaries, ONE file per tool call, commit after each 2-3 files)
- Add the 4 new keys and update `footerCopyright` in all 12 files under `src/lib/i18n/dictionaries/`. Natural translations; company name untranslated. If the dictionary type requires keys, `en.ts` first, then the rest.

## 3. Terms: delivery clause
- Add a short section to `src/app/terms/page.tsx` (after the booking/refund section): "**Delivery of tickets** — AforAudience sells no physical goods. Tickets are delivered electronically: on confirmation they appear in My Tickets in the app and a confirmation is sent to the email address on the account, normally within minutes. If you don't receive it, contact info@aforaudience.com." Update "Last updated" to the commit date.

## Tests (T1)
- Extend `e2e/legal-pages.spec.ts` (or a new `e2e/footer-legal.spec.ts`): on `/` the footer has links with href `/terms/`, `/refund-policy/`, `/contact/`, `/privacy/`, each returns 200; footer text contains "Shyamkasturi Productions Private Limited" and "2026"; Terms contains "Delivery of tickets". One non-English locale (hi) shows the company name in Latin script.
- Regression shape: the footer assertions fail on `origin/qa` and pass on the branch (show both).
- Update affected homepage screenshot baselines only if the footer is inside them; justify each baseline change in the status file.
- tsc, unit self-tests, eslint (touched files), checker/ratchet green on the pushed head.

## Finish
- Status file `cc-autopilot-status.md` (T7). Also list, for the prod port that follows, the exact files touched (chat will port pages + footer to a branch off `origin/main`).
- Human check for Hitesh: footer on phone and desktop in en + one Indic locale; read the delivery clause.
- Do not touch the Feedback table. No data changes.
