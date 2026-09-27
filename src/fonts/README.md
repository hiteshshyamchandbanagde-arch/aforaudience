# Self-hosted fonts (BUG-2609-062)

Every webfont the app uses lives here and is loaded by `next/font/local`
in `src/app/layout.tsx`. Nothing is fetched from Google at build time or
at runtime. (Until 27 Sep 2026 `next/font/google` downloaded these at
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

## Updating a font

Download the new upstream TTF, rerun the same instancer/subset steps
with the codepoint set read from the current file's cmap (plus any
additions), and re-check parity before committing.
