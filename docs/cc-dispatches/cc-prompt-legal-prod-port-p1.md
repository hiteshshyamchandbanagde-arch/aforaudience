# CC dispatch: run P1, port legal pages + footer to PRODUCTION base (Hitesh-approved docs-only freeze exception, 8 Nov)

> **New branch `fix/legal-prod-port` off `origin/main`** (NOT qa): `git fetch origin main && git checkout -b fix/legal-prod-port origin/main`. Small chunks: one small edit, commit, push, next. 45-min hard limit. Push, write the status file **on the branch** (`cc-autopilot-status.md`), stop. Chat opens the PR to `main`; Hitesh OKs the file list before merge. **Never push to main or qa. Never touch `.github/workflows/`. Never `git stash pop` on a clean tree.**

**Why:** Razorpay verifies aforaudience.com (prod = the ~14 Jul build on `main`). Prod's footer has only Privacy (a "Coming Soon" stub), no Terms/Refund/Contact, no company name, "© 2025 AforAudience". QA already has the finished content: #763 (pages) and #764 (footer + delivery clause, `fix/legal-footer-l2`). This run brings ONLY that content to `main`.

## Scope (only these files; nothing else changes)
`main` lacks `LegalDocLayout`, `refund-policy.ts`, the i18n dictionaries' footer keys and (probably) the design-token CSS variables. So the port must be **self-contained**:
1. `src/components/LegalDocLayout.tsx` — copy from `origin/fix/legal-footer-l2`. If it uses `var(--afa-…)` tokens or helpers that don't exist on `main`, replace them with the equivalent literal values from qa's `globals.css` / `design-tokens.ts` (look them up; don't guess) or with whatever `main`'s own pages use. Check `main`'s `globals.css` first: if the variables exist there, keep them.
2. `src/app/terms/page.tsx` (new on main), `src/app/privacy/page.tsx` (replace the stub), `src/app/refund-policy/page.tsx` (new), `src/app/contact/page.tsx` (new) — copy from `origin/fix/legal-footer-l2` (Terms includes the §4 Delivery clause). In the refund page, `main` has no `refund-policy.ts`: inline the thresholds as constants (`14` and `7`) with a comment pointing to qa's `src/lib/refund-policy.ts`. Keep every company fact exactly as on qa.
3. Footer in `src/app/page.tsx` (main's homepage; English, hard-coded): after "Privacy Policy" add Terms of Service `/terms/`, Refund & Cancellation `/refund-policy/`, Contact Us `/contact/`; copyright line becomes "© 2026 Shyamkasturi Productions Private Limited. All rights reserved." with a second small line "AforAudience is a product of Shyamkasturi Productions Private Limited." Match the surrounding inline-style conventions of that file. If another footer renders site-wide on main, apply the same there and list it.
- Respect main's `trailingSlash` setting (check `next.config`); links must not 404 or redirect-loop.
- Do NOT bring any other qa code, migrations, dependencies or config. If a copied page needs an import that doesn't exist on main, inline it or drop it (say which in the status file).

## Checks (T7, proportionate: this is a content port)
- `npx tsc --noEmit` and `npm run build` pass on the branch (main's own toolchain). Note any pre-existing errors on `origin/main` separately.
- Local `next start`: `/`, `/terms/`, `/privacy/`, `/refund-policy/`, `/contact/` each 200; each legal page contains "Shyamkasturi Productions Private Limited"; footer shows the 4 links and "© 2026". Commit these as `e2e/legal-prod-port.spec.ts` **only if** `main` already has Playwright set up; otherwise paste the curl/grep output in the status file.
- `git diff --stat origin/main...HEAD` in the status file: must list only the files above (+ the spec if added).
- Human check for Hitesh: open the Vercel preview of this branch on phone; read the 4 pages and footer once.
- No data changes, no env/Vercel changes, no Feedback table.
