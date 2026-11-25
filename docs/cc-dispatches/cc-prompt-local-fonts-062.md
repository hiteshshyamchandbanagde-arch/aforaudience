# CC dispatch: BUG-2609-062 — self-host all fonts (next/font/google → next/font/local)

> **One branch, this ticket only. Do NOT stack. Do NOT start another ticket in this run.** Push, hand off the compare link, stop. Chat merges. **Never `git stash pop` on a clean tree.** **Priority: blocker** — every Vercel preview, `qa` included, is red until this lands.

**Start:** `git fetch && git reset --hard origin/qa`, read `HANDOFF.md` (27 Sep part 6) and `src/app/layout.tsx` lines 1-170 in full (the font comments carry the history).
**Branch:** `fix/bug-2609-062-local-fonts`, off `origin/qa`.

## Why
`next/font/google` downloads font files at build time. Since ~05:15 UTC 27 Sep, Vercel builds fail on it consistently. `qa@fda34f1` (docs-only) failed, and so did PR #711 and a forced redeploy of #711. The failing family changes between runs (Noto Sans Gujarati, then Malayalam), so this is the Google fetch, not any one font. Earlier it was intermittent (#708, #710). It must never depend on the network again.

## Scope: all 15 `next/font/google` calls in `layout.tsx` (11 physical families)
- Latin roles: Young Serif 400 (`--font-display`), Schibsted Grotesk 400-800 + italic (`--font-ui`), Instrument Sans 400-600 (`--font-sans`), JetBrains Mono 400-600 (`--font-mono`).
- Their 4 `*Phys` duplicates (`--font-phys-*`) must point at **the same files** as their role sibling. Do not duplicate the files.
- Noto Sans Devanagari, Tamil, Telugu, Kannada, Malayalam, Gujarati and Bengali, 400 and 500 each (`--font-devanagari` … `--font-bengali`).

## Requirements
1. Replace every `next/font/google` import with `next/font/local`. Font files go under `src/fonts/<family>/` as woff2, committed. Get them from a reliable source (e.g. the `@fontsource/*` packages' woff2 files, copied in, **not** added as a runtime dependency). Record the source and version in `src/fonts/README.md`.
2. **Keep the same names:** the same CSS variable names, weights, styles and `display: swap`. Nothing outside `layout.tsx` and `src/fonts/` should need to change.
3. **Glyph parity is the acceptance bar, not file names.** Every character that renders in a webfont today must still render in that same webfont afterwards. Check these specifically: the rupee sign `₹` (U+20B9, which Google serves in `latin-ext` for some families) in the display, ui, sans and mono fonts; accented Latin; and each Indic script in its Noto family. If a family needs more than one subset file per weight, combine them into one file per weight (fonttools `pyftsubset`/merge) or use multiple `src` entries, whichever keeps parity. Say which you chose and why.
4. Keep the Noto families as fallback-only. Their files should cover their script, not Latin, so a Latin-only page doesn't download them.
5. **No network at build time.** After the change `grep -rn "next/font/google" src` returns nothing, and a production build succeeds with Google Fonts unreachable (block `fonts.googleapis.com` and `fonts.gstatic.com`, e.g. in the hosts file, for that one build).
6. Report the total font weight before and after (sum of the woff2 sizes Next emits into `.next/static/media`). A noticeable increase needs a line of justification.
7. Leave the intro splash alone (BUG-2609-064, the hydration warning, is a separate ticket).

## Visual check (required)
Before/after screenshots at 390 and 1280, production builds: `/` in English (display + ui + sans), a page with a `₹` price (the event detail page), a mono-heavy page (`/dashboard/admin/artists`), and `/` switched to hi, ta, bn and gu. Expected result: **pixel-identical or indistinguishable**. Call out any difference.

## Verification (report each)
tsc; `next build` online **and** with Google Fonts blocked; checker vs origin/qa; ratchet unchanged; all self-tests; ESLint per-line diff on touched files; `next dev` renders the screenshot pages.

## Handoff must include
Compare link, commits, the file list with sizes, the subset/merge decision, the font weight before and after, the screenshot summary, and confirmation that the offline build passed.
