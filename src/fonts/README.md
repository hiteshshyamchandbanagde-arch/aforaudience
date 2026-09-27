# Self-hosted fonts (BUG-2609-062)

Every webfont the app uses lives here and is loaded by `next/font/local`
in `src/app/layout.tsx`. Nothing is fetched from Google at build time or
at runtime. (Until 27 Sep 2026 the Google Fonts loader downloaded these at
build time; that fetch started failing every Vercel build.)

Each folder has the family's `OFL.txt` (SIL Open Font License 1.1).

## Source and version

Full upstream TTFs from [google/fonts](https://github.com/google/fonts):
the same files the Google Fonts API serves, and the **same version**
Google was serving when this was built (checked against the name-table
version of the files the old loader downloaded).

| Folder | Upstream file (`ofl/<dir>/`) | Version | google/fonts commit |
|---|---|---|---|
| `young-serif` | `YoungSerif-Regular.ttf` | 3.003 | `23e54b51` |
| `schibsted-grotesk` | `SchibstedGrotesk[wght].ttf`, `SchibstedGrotesk-Italic[wght].ttf` | 1.100 | `23e54b51` |
| `instrument-sans` | `InstrumentSans[wdth,wght].ttf` | 1.000 | `23e54b51` |
| `jetbrains-mono` | `JetBrainsMono[wght].ttf` | 2.211 | `23e54b51` |
| `noto-sans-devanagari` | `NotoSansDevanagari[wdth,wght].ttf` | 2.006 | `03a18200` (2.007 is newer upstream; 2.006 is what Google served) |
| `noto-sans-tamil` | `NotoSansTamil[wdth,wght].ttf` | 2.004 | `23e54b51` |
| `noto-sans-telugu` | `NotoSansTelugu[wdth,wght].ttf` | 2.005 | `23e54b51` |
| `noto-sans-kannada` | `NotoSansKannada[wdth,wght].ttf` | 2.006 | `23e54b51` |
| `noto-sans-malayalam` | `NotoSansMalayalam[wdth,wght].ttf` | 2.104 | `23e54b51` |
| `noto-sans-gujarati` | `NotoSansGujarati[wdth,wght].ttf` | 2.106 | `23e54b51` |
| `noto-sans-bengali` | `NotoSansBengali[wdth,wght].ttf` | 3.011 | `23e54b51` |

Full commit ids: `23e54b51ddffbc7713c583748e3bd86f62b1fa4a`,
`03a182001fd7b1ccb3960a8faa8b616619c0d1a1`.

## How the woff2 files were made

fontTools 4.66.0 (`instancer` + `subset`), `PYTHONHASHSEED=0`, source
`head.modified` kept, so the bytes are reproducible.

1. `wdth` pinned to 100 (the default, which is all Google served) and
   `wght` limited to the range Google served: Schibsted 400-900,
   Instrument 400-700, JetBrains 400-800, Noto 100-900. If a font's
   range already matches, the instancer is skipped, because a no-op
   instancer pass re-encodes `gvar` and moves points by fractions of a
   unit.
2. Subset to **exactly the codepoints Google's files rendered**: for each
   Google subset file, its cmap intersected with its `unicode-range`,
   unioned per family.
   - Latin families: all of Google's subsets are **merged into one
     file** (latin + latin-ext, plus cyrillic/greek/vietnamese for
     JetBrains Mono). That is why the rupee sign (U+20B9, in Google's
     latin-ext file) still comes from Schibsted Grotesk. Young Serif,
     Instrument Sans and JetBrains Mono have no rupee glyph at all, so
     there it renders from the metric-matched fallback, as before.
   - Noto families: only the script subset(s). Google's latin and
     latin-ext files for these families are dropped, because Latin
     always resolves earlier in the font stack. The file keeps the
     script file's full cmap (it includes U+0020, which HarfBuzz uses to
     hide ZWNJ/ZWJ). The `unicode-range` in `layout.tsx` is the exact
     rendered set, and `preload: false`, so a Latin-only page never
     downloads them.
3. All layout features kept, unhinted (like Google's served files),
   woff2.

**One file per family and style, not multiple `src` entries.**
`next/font/local` can't give each `src` entry its own `unicode-range`,
so Google's split files can't be reproduced one-to-one. Merging keeps
every glyph in the same font, with no per-character fallback between
files of the same family.

The one rendering difference from merging: kerning and contextual
features now apply across a latin/latin-ext boundary inside one word,
e.g. "Tō". Before, those were two font files, so there was no kerning
between them.

## Parity check (how this was verified)

Against the files the old loader emitted (qa@d2f7739 production build):
- every rendered codepoint × every declared weight: same decomposed
  outline (to 1/100 unit) and same advance (11,436 checks);
- HarfBuzz shaping of each subset's full codepoint string, and of every
  string in the matching `src/lib/i18n/dictionaries/<locale>.ts` for the
  7 Indic scripts (~40k runs): same glyphs, advances and offsets;
- `hhea`/`OS/2` vertical metrics identical.

## Fallback faces

`fallbacks.css` holds the metric-matched `* Fallback` faces (local
Arial / Times New Roman with ascent/descent/size overrides), copied
verbatim from what the Google loader generated. `layout.tsx` sets
`adjustFontFallback: false` and names these via `fallback`. With
`next/font/local`'s own computed values they would drift (e.g.
JetBrains Mono size-adjust 131.49% vs 134.59%), and the fallback face
is what renders any character a webfont lacks.

## Rerunning the build (upgrade or add a font)

The scripts that built these files and checked parity are in
`scripts/dev/fonts/`. They are dev-only: nothing in `src/` imports them,
and neither CI nor `next build` runs them.

| File | What it does |
|---|---|
| `fonts.json` | One entry per woff2: upstream path, pinned google/fonts commit and sha256, served `wght` range, weights to check, output path, locale (Noto only) |
| `fetch_sources.py` | Downloads the pinned TTFs and each family's `OFL.txt`, checks the sha256 |
| `build_fonts.py` | Instancer + subset + woff2, as described above, into `src/fonts/` |
| `verify_parity.py` | Before/after check: outlines, advances, HarfBuzz shaping, vertical metrics |
| `offline-build-proxy.mjs` | Checks that `next build` fetches nothing from Google (usage in its header) |
| `requirements.txt` | Pinned tools |

**Tools:** Python 3.14 and `pip install -r scripts/dev/fonts/requirements.txt`
(fontTools 4.66.0, brotli 1.2.0, uharfbuzz 0.56.2). Another fontTools
version can produce different bytes; step 1 below shows whether it does.
Use a work folder outside the repo, e.g. `W=$(mktemp -d)`.

**1. Check the recipe still reproduces (always do this first):**

```sh
python scripts/dev/fonts/fetch_sources.py "$W"
PYTHONHASHSEED=0 python scripts/dev/fonts/build_fonts.py "$W" --out "$W/out"
python scripts/dev/fonts/verify_parity.py --new-dir "$W/out"   # TOTAL DIFFERENCES: 0
```

On 27 Sep 2026 this rebuilt all 12 files byte-identical to the committed
ones, and parity reported 0 differences.

**2. Upgrade a font to a newer upstream version:**

1. In `fonts.json`, change that font's `commit`. Run `fetch_sources.py "$W" --no-verify`;
   it prints the new file's sha256, which you then paste into `fonts.json`.
2. `PYTHONHASHSEED=0 python scripts/dev/fonts/build_fonts.py "$W" --only "Noto Sans Tamil|normal"`
   writes the new file into `src/fonts/`. The codepoint set comes from
   the committed file's cmap (`--ref-git`, default `HEAD`), so it stays
   exactly what it was.
3. `python scripts/dev/fonts/verify_parity.py --only "Noto Sans Tamil|normal"`
   compares it with the committed file. A new version will show
   differences. Read them, then look at the pages that use the font (for
   a Noto family, that locale's pages) before committing.
4. Update the Version and commit columns in the table at the top.

**3. Add codepoints to a font:** add `--add "Schibsted Grotesk|normal=U+2192,U+2190"`
to the build command. For a Noto family, also add the printed range to
that family's `unicodeRange` in `src/app/layout.tsx`, since the browser
uses that range to decide when to download the file.

**4. Add a new family:** add a `fonts.json` entry, then build it with
`--only` and `--add` giving its full codepoint set (there is no committed
file to read one from; parity skips it for the same reason). Then add
its folder's `OFL.txt`, its entry in `layout.tsx` (with a `* Fallback`
face in `fallbacks.css`), a row in the table at the top, and run the
offline build check.
