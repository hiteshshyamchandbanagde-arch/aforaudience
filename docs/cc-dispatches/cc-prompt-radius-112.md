# CC dispatch: GEN-2609-112 — radius closeout (310 → 0)

> **One branch, this ticket only. Do NOT stack. Do NOT start another ticket in this run.** Push, hand off the compare link, stop. Chat merges and applies the DB SQL.

**Start:** `git fetch && git reset --hard origin/qa`, read `HANDOFF.md` (26 Sep entry) and `docs/decisions/2026-09-26-radius-colour-scale.md` §1.
**Branch:** `chore/gen-2609-112-radius-closeout`, off `origin/qa`.

## Measured baseline (chat, `qa@f4202a8`, using the checker's own RULES)
- `radius-literal` = 310 across 104 files. Shapes: 280 single-value JSX `borderRadius`, 18 multi-value (`"8px 8px 0 0"`), 4 `<style>`-block CSS, 4 Tailwind `rounded-[16px]`, 4 other.
- By value: 8px 50 · 3px 43 · 12px 38 · 6px 32 · 999px 31 · 10px 24 · 2px 15 · 4px 11 · 16/16px 16 · 20/20px 8 · 999 5 · 14/14px 7 · 12 (bare number) 9 · 8 (bare) 4 · 99px 3 · 5px 3 · 24 2 · 10 (bare) 2 · 7px 1 · others 1–2.
- About 175 already match an existing `RADIUS_MAP` value; the radius category has simply never been applied. ~33 are bare numbers (`borderRadius: 12`), which the px-only matcher can't see.

## Final scale (decided — see the decision record; do not re-litigate, report if something looks visibly wrong)

| Token | Value | Absorbs |
|---|---|---|
| `--afa-radius-sharp` | 0px | 0 |
| `--afa-radius-xs` **(new)** | 3px | 2, 3, 4 |
| `--afa-radius-sm` | 6px | 5, 6, 7 |
| `--afa-radius-md` | 8px | 8 |
| `--afa-radius-lg` **(renamed from `--afa-radius-12px`)** | 12px | 10, 12, 14 |
| `--afa-radius-xl` **(new)** | 16px | 16 |
| `--afa-radius-2xl` **(new)** | 20px | 20, 24 |
| `--afa-radius-pill` | 999px | 99, 999 |

`--afa-radius-10px` is **retired**: its 29 existing `var()` consumers move to `--afa-radius-lg` (10 → 12px, accepted).

## Steps (one commit each)
1. **Tokens.** Update `globals.css`, `design-tokens.ts`, `afa-design-tokens-reference.md` and `RADIUS_MAP` to the table above. Remove `--afa-radius-10px`/`--afa-radius-12px` definitions. Rewrite all existing `var(--afa-radius-10px)` and `var(--afa-radius-12px)` references. Write the QA DB SQL (rename `--afa-radius-12px` → `--afa-radius-lg` keeping its value, delete `--afa-radius-10px`, insert xs/xl/2xl) into the handoff — **do not run it**; chat applies it after merge.
2. **Matcher: bare-number `borderRadius`.** React treats `borderRadius: 12` as px. Extend `migrate-tokens.js` so a bare numeric radius (the 5 radius props only, never spacing/font-size) maps via `RADIUS_MAP` to the string `"var(--afa-radius-*)"`. Unit tests for it. `verify-equivalence.js` must treat `12` ≡ `12px` for radius props.
3. **Rounding map.** Add the off-scale values from the table (2, 4, 5, 7, 10, 14, 24, 99) as explicit `RADIUS_ROUND` entries, **separate from `RADIUS_MAP`**, so `verify-equivalence.js` reports them as intentional value changes, not equivalences. Print the per-value count of rounded sites in the handoff.
4. **Apply**, in area commits (public / dashboard / app-root / components), dry run reviewed first. Multi-value shorthands convert per part. Tailwind `rounded-[16px]` → `rounded-[var(--afa-radius-xl)]`. `<style>` blocks unquoted.
5. **Leftovers.** Anything still counted: either convert by hand or, if structural (e.g. a radius computed from props, `50%` circles), add a `token-ok` reason. Target `radius-literal` = 0; report every exemption with file:line and reason.
6. **Regenerate `TOKEN_COVERAGE` once, last**, and update the ratchet baseline (radius must be 0 or equal to the exemption count, nothing else may rise).

## Verification (report each)
tsc; `check-design-tokens.js` vs origin/qa; ratchet; migrate-tokens + checker self-tests; `verify-equivalence.js` (equivalences clean, rounded sites listed); ESLint per-line diff on touched files; `next build`; `next dev` renders `/`, `/events`, `/login`, `/dashboard`. Screenshot `/`, an event detail page, and `/login` at mobile width before/after — call out any visible difference beyond 2px corner changes.

## Handoff must include
Compare link, commit list, ratchet before/after, rounded-site counts per value, exemptions, the DB SQL (not run), and anything that looked wrong.
