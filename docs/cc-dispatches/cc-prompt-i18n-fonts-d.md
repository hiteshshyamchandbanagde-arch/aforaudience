# CC dispatch: run D, Indic fonts + Marathi/Hindi four-room names (Hitesh phone pass 13-14 Oct; decision 14 Oct)

> **New branch `fix/i18n-fonts-d` off `origin/qa`.** Small chunks (AGENTS.md): one small edit, commit, push, next; one locale file per tool call. **45-min hard limit, push after every commit** (autopilot token lives 60 min). Push, write the status file, stop. Chat opens the PR and merges. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa` (must include this file and #756-#758). Read `HANDOFF.md` Part 60 (batch D) and Part 58 ("DECIDED"), `docs/design.md`, `src/app/globals.css` (font variables, and the BUG-2610-030 `:lang()` block around line 484), `e2e/homepage-hindi.spec.ts`.

## 1. Indic locales: mono-font labels → sans
- On Hitesh's phone (Marathi), labels set in the mono font (`--font-mono`, Geist Mono, about 56 uses in `src/`) show double-width gaps: Geist Mono has no Devanagari, so the fallback is spaced on the mono grid.
- Fix it the way BUG-2610-030 fixed letter-spacing: in `globals.css`, for `:is(:lang(hi), :lang(mr), :lang(bn), :lang(gu), :lang(kn), :lang(ml), :lang(ta), :lang(te))`, make text that uses the mono font render in the sans font. Prefer one CSS rule (for example, redefine `--font-mono` to the sans stack under those `:lang()` selectors) over editing 56 call sites. Check it also covers Tailwind `font-mono` classes and inline `fontFamily: 'var(--font-mono)'`.
- English and the other Latin locales keep the mono font. Numbers that rely on mono for alignment (tables, prices) in Indic locales: check that nothing jumps; say what you saw.

## 2. Marathi and Hindi four-room names (Hitesh decision, 14 Oct)
- Replace the transliterations ("द हाऊस", "द स्टेज", …) with these exact names:

| Key | mr | hi |
|---|---|---|
| `fourRoomsHouseName` | प्रेक्षागृह | प्रेक्षागृह |
| `fourRoomsStageName` | रंगमंच | रंगमंच |
| `fourRoomsBoothName` | सूत्रधार कक्ष | सूत्रधार कक्ष |
| `fourRoomsVenueName` | दालन | कक्ष |

- Only these 8 strings change. One locale file per tool call. If any other string in mr/hi refers to these rooms by the old transliterated name (for example, "द हाऊस" in a sentence), list it in the status file but don't change it.

## Tests (T1)
- e2e: in `hi` and `mr`, an element that uses the mono font computes to the sans family; in `en` it stays mono.
- e2e: the four-rooms section in `mr` and `hi` shows the new names.
- Screenshots at 390 + 1440 of one mono-label area in `mr` and the four-rooms section in `mr`; update baselines that change and list them with the reason (T2).
- Each regression must fail on `origin/qa` and pass on the branch (show both).

## Finish
- tsc, unit self-tests (including `scripts/i18n-untranslated.test.ts`), eslint (touched files), checker/ratchet green on the pushed head.
- Status file `cc-autopilot-status.md` (T7) with a Human check for Hitesh, phone: Marathi and Hindi home page — the room names read right and no labels have double-width gaps.
- Do not touch the Feedback table. No seed or data changes.
