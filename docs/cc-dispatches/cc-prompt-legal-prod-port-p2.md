# CC dispatch: run P2, port D4 legal wording (Pay at entry + Direct payments) to PRODUCTION base

> **New branch `fix/legal-prod-port-p2` off `origin/main`** (NOT qa): `git fetch origin main qa && git checkout -b fix/legal-prod-port-p2 origin/main`. Content-only. Push, status file (do NOT commit it), stop. 30-min limit. Chat opens the PR to `main`; **Hitesh must OK before merge**. Never push to main or qa; never touch `.github/workflows/`. **Never `git stash pop` on a clean tree.**

**Why:** #771 (D4, merged to qa as a27b88b) updated Terms + Refund policy for the free-only soft launch: three ticket types (Free / Pay at entry / Online when offered), new "Direct payments between users" section, refund policy scoped to online payments + new "Pay at entry and direct payments" section. Prod (aforaudience.com) still says only online payment + ₹20 booking fee. `main`'s legal pages are the self-contained P1 port (#765): own `LegalDocLayout` with literal styles, refund tiers inlined 14/7.

## Do
- Only `src/app/terms/page.tsx` and `src/app/refund-policy/page.tsx` on the branch change.
- Get the exact D4 text change: `git diff a27b88b~1 a27b88b -- src/app/terms/page.tsx src/app/refund-policy/page.tsx` (on qa). Apply the **same wording changes** to main's versions, keeping main's imports/components (no `@/lib/refund-policy` import — keep the inlined 14/7 constants; no design tokens that main lacks). Section numbering and "Last updated" must match qa's result.
- After editing, the visible text of both pages on main must equal qa's (except styling). Check: build both and diff the rendered text (or diff the JSX text nodes) — paste the result in the status file.
- `npx tsc --noEmit` + `npm run build` pass on the branch (note pre-existing errors on origin/main separately). `git diff --stat origin/main...HEAD` = exactly those 2 files.

## Finish
Status file (T7): diff stat, text-equality check result, build result, pushed head. Human check: Hitesh reads /terms/ and /refund-policy/ on the preview. No data, env or Vercel changes; no Feedback table.
