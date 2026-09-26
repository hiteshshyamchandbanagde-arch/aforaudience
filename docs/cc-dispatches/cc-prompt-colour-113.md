# CC dispatch: GEN-2609-113 — colour closeout (rgba 512 + hex 51 → 0)

> **One branch, this ticket only. Do NOT stack. Do NOT start another ticket in this run.** Push, hand off the compare link, stop. Chat merges and applies the DB SQL. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa`, read `HANDOFF.md` (26 Sep entries) and **`docs/decisions/2026-09-26-radius-colour-scale.md` §2 — that is the spec; this file is the procedure.**
**Branch:** `chore/gen-2609-113-colour-closeout`, off `origin/qa`.

## Measured baseline (chat, `qa@19e23c6`, checker's own RULES)
- `rgb-rgba-literal` 512 across 109 files (context: border 198, text 133, bg 128, shadow 20, svg 16, other 17). Ratchet baseline still says 543; #707 dropped it to 512 without updating the file.
- `hex-color-literal` 51 across 15 files.

## Steps (one commit each)

1. **Tokens.** Add every new token from decision §2a–2c to `globals.css`, `DEFAULT_TOKEN_VALUES` in `design-tokens.ts`, `afa-design-tokens-reference.md`, and `COLOR_MAP`. Tints are literal `rgba()` values, not `color-mix()`. Change `--afa-text-muted` 0.40 → 0.50. Remove `--afa-error-border` (0 consumers — re-check). Write the QA DB SQL (inserts for the new keys; `UPDATE` of `--afa-text-muted` to `rgba(245, 245, 240, 0.5)`; delete of `--afa-error-border`) into the handoff — **don't run it**.

2. **Contrast fixes found in #707** (these change colour on purpose; list every site):
   - `STATUS_TONE.gold` text: `--afa-gold` measures 2.55:1 on its own tint. Use `--afa-amber` (4.88:1). Check anything else that sets `--afa-gold` as text on a dark or tinted surface.
   - Plain `--afa-error` **text** on dark surfaces measures 2.5–2.8:1. Use `--afa-error-bright` (5.7–6.4:1) for error text. `--afa-error` stays for fills, borders and icons.

3. **Matcher.** The rounding in §2 is context-dependent for cream alphas ≥ 0.30 (text → `text-*`, non-text → `tint-30`). Add a `COLOR_ROUND` map (separate from `COLOR_MAP`, same idea as `RADIUS_ROUND`) keyed on value + context, so `verify-equivalence.js` reports rounded sites as intentional changes, not equivalences. Cream `rgba(247,243,238,a)` folds into the `245,245,240` ladder. Unit tests.

4. **Apply** in area commits (public / dashboard / app-root / components). Dry run reviewed before each. Include `src/lib/statusStyle.ts` this time (it was excluded from GEN-2609-100). `<style>` blocks unquoted; Tailwind brackets as `border-[var(--afa-*)]` etc.

5. **Hex** per §2d. SVG presentation attributes (`fill=`, `stroke=`, `stopColor=`) move to `style={{ ... }}` because attribute `var()` isn't reliable. `BrandLoader.tsx` gets `token-ok` with the reason "pixel copy of src/app/icon.svg; logo colours must not follow palette edits". Drop the `#b3261e` fallback in `var(--afa-error, #b3261e)`.

6. **Shadows and gradients.** `rgba(10,10,10,0)` gets `token-ok` ("transparent end of an image fade, structural"). Other shadow/scrim values per §2c. For compound values (`box-shadow`, `linear-gradient`) replace only the colour part.

7. **Leftovers → 0.** Convert by hand or `token-ok` with a reason. Target: hex 0 and rgba 0, apart from listed exemptions. Report every exemption with file:line and reason.

8. **Regenerate `TOKEN_COVERAGE` once, last**, and update the ratchet baseline (hex/rgba to the exemption count; nothing else may rise).

## Visual check (required — this ticket changes colours on purpose)
Screenshot at 390px and 1280px, before/after, pixel-diffed: `/`, `/events`, an event detail page, `/login`, `/register`, `/tickets` (as Atul). Expected visible differences, and only these:
- muted text slightly brighter everywhere;
- home "near you" rails' warm-grey text now neutral;
- some input backgrounds darker (`#171717` → inverse);
- gold badge text brighter; error text brighter.
Call out anything else. List the dashboard pages that change so Hitesh can eyeball them (he has the admin login).

## Verification (report each)
tsc; `next build`; checker vs origin/qa; ratchet; all self-tests (and wire the #707 `ticket-code` and username tests into the CI test step while you're in `package.json`/workflow, if that's a one-line change — otherwise just report); `verify-equivalence --base=origin/qa` (0 unexpected mismatches, rounded sites listed per value); ESLint per-line diff on touched files.

## Handoff must include
Compare link, commits, ratchet before/after, rounded-site counts per value, every intentional colour change (step 2) with file:line, exemptions, the DB SQL (not run), screenshots summary, and the dashboard pages for Hitesh to check.
