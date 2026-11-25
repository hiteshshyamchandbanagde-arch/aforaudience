# CC dispatch: GEN-2609-107 spacing, phase 1 — exact-match conversion only

> **New branch `chore/gen-2609-107-spacing-p1` off `origin/qa`.** Push, hand off, stop. Chat merges. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa` (≥ `5965ee5`, #716). Read `HANDOFF.md` parts 19-21, `docs/token-migration-status.md` §spacing, and the GEN-2609-107/108 entries in `docs/design.md`.

## Standing decisions (don't reopen)
- Spacing moves onto `--afa-space-*` for hygiene. It stays **hidden from the admin editor** (GEN-2609-108). No density multiplier in this ticket.
- `token-ok` is scoped (`token-ok(spacing-literal): reason`), and a comment that exempts nothing is not allowed.

## Scope: phase 1 = zero visual change
1. **Measure first (dry run, no `--apply`):** run `migrate-tokens.js --categories=spacing` over all of `src/`. Report: total `spacing-literal` (baseline 1864), exact-match convertible count, and the non-matching values as a frequency table (value → count → top 3 files).
2. **Excluded paths (never apply here):** `src/lib/email.ts`, `src/lib/ticket-pdf.ts`, `src/app/api/posters/**`, `src/app/manifest.ts`. CSS vars don't render there (GEN-2609-119 handles them). If the script would touch them, stop and fix the exclusion first, with a self-test.
3. **Apply exact matches only** onto the existing 14 tokens (`--afa-space-1..6`, `-2px/-6px/-10px/-14px/-18px/-28px/-32px/-48px`). One commit per area: public, dashboard, app-root, components. Run `verify-equivalence.js` after each commit (must be clean).
4. **No new tokens, no snapping, no rounding.** Values without an exact token stay as they are and go in the handoff table. Chat decides phase 2 (new scale points vs. snapping) from that table.
5. **Blind spots:** ternaries, `calc()`, JS variables and Tailwind brackets that hold spacing. Count them (bounded grep is fine) and list them. Don't convert them.

## Ratchet
`spacing-literal` goes down by exactly the number applied. Lower the baseline to match. Every other category is unchanged.

## Verification
tsc; `next build`; checker vs origin/qa; ratchet; `verify-equivalence.js` clean per commit; all self-tests; ESLint per-line diff on touched files. Pixel-diff screenshots (390 + 1280, production builds, qa vs branch) of `/`, `/events`, an event detail page, `/venues`, `/register`, the organiser dashboard and `/dashboard/admin/design-system`: 0 changed pixels expected. Any difference is a finding, so report it rather than accepting it.

## Handoff (delta-only)
Compare link; commits; before/after `spacing-literal`; converted count per area; the non-matching value table; the blind-spot counts; pixel-diff results.
