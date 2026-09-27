# CC dispatch: GEN-2609-116 — small bundle (BUG-2609-063 autofill, last 13 font-size literals, font scripts)

> **One branch, these 3 items only. Do NOT stack. Do NOT start another ticket in this run.** Push, hand off the compare link, stop. Chat merges. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa` (at `ea48df9` or later), read `HANDOFF.md` 27 Sep parts 8-10 and this file in full.
**Branch:** `fix/gen-2609-116-small-bundle`, off `origin/qa`. One commit per item.

## Item 1: BUG-2609-063, autofill leaves Sign In disabled (MEDIUM)
- `src/app/(auth)/login/page.tsx`: Sign In (~L233) is disabled on `!identifier || !password`. Chrome autofill fills the inputs visibly but doesn't fire React `onChange` until the user interacts, so the button renders disabled and the first click does nothing for anyone using saved passwords. Send code (~L252) and Verify (~L283) use the same pattern.
- **Fix:** disable only while a request is in flight. On submit, read the real input values (ref or `FormData`, not just state). If a field is empty, show an inline message ("Enter your email or phone", "Enter your password", etc.) in the existing error style and put focus on that field. Don't show anything before submit.
- Check **register, forgot-password, reset-password, verify-email and verify-phone** for the same disabled-on-empty pattern and fix each in the same way. List each site with file:line.
- **Autofill colour:** Chrome paints autofilled inputs light blue with dark text on the dark auth card. Add one global rule in `globals.css`: `:-webkit-autofill` (plus `:hover`, `:focus` and `:active`) with `box-shadow: inset 0 0 0 1000px var(--afa-surface-inverse)`, `-webkit-text-fill-color: var(--afa-text-primary)` and `caret-color: var(--afa-text-primary)`. If some inputs don't sit on `--afa-surface-inverse`, check that the rule still looks right on them, or scope it, and say which you did.
- **Test:** with Chrome saved credentials (or Playwright filling the DOM value without input events), load `/login`. The first click on Sign In must submit. Test the empty-field messages too, and keyboard Enter.

## Item 2: font-size literals 13 → 0
- Run the checker. It lists the 13 `font-size-literal` sites. For each one, either move it to an existing type-scale token (`--afa-text-*`, the size roles, not the colour roles) if one matches within 0.5px, or keep it with a `token-ok:` reason if it's a genuine one-off (e.g. a display size only used once).
- **No new tokens** unless a value repeats at 3 or more sites (the 3-site rule).
- Ratchet: `font-size-literal` 13 → 0 unexplained. Nothing else may rise. Regenerate `TOKEN_COVERAGE` last.
- In the handoff, give a table: file:line · old value · new token or reason · visible change (px).

## Item 3: commit the BUG-2609-062 font scripts
- Put the scripts that built the `src/fonts/` files and checked parity into `scripts/dev/fonts/`, with a README section in `src/fonts/README.md` on how to rerun them to upgrade or add a font.
- Keep them dev-only: nothing in `src/` imports them, and they're not run in CI or the build. Pin any tool versions they need (e.g. fonttools) in the README.
- Keep the README free of the old loader's import path (the reason for commit `39c783b`).

## Verification (report each)
tsc; `next build`; checker vs origin/qa; ratchet (font-size 13 → 0, all others unchanged); all self-tests; ESLint per-line diff on touched files; the item 1 autofill test; screenshots at 390 and 1280 of `/login`, `/register`, `/forgot-password` (empty submit, filled, and autofilled) and of each font-size site that visibly changed; `next dev` renders all of them. Vercel preview green on the pushed head.

## Handoff must include
Compare link, commits, the item 1 site list, the item 2 table, the scripts list, the screenshots summary and the click-through list for Hitesh (logged out: saved-password login on a real Chrome profile).
