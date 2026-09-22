// GEN-2609-089 - lighter-weight replacement for the verify-equivalence.js
// rebuilt-3-times-before scratch script (see docs/design.md's
// verify-equivalence-recurring-bugs finding). Earlier batches' version
// re-derived token values from a resolved diff and compared them against
// the literal they replaced - useful when a migration script does fuzzy
// or generated replacement. migrate-tokens.js instead replaces directly
// from SPACING_MAP/FONT_SIZE_MAP/RADIUS_MAP, whose entries are dictionary
// literals hand-copied from globals.css once - so the actual risk isn't
// "did the replacement resolve to the right value" (it's true by
// construction, every replacement IS a map lookup), it's "did the map
// itself get transcribed correctly." This script checks exactly that:
// parses globals.css's real --afa-* declarations and diffs them against
// migrate-tokens.js's hardcoded maps, catching any stale/mistyped entry
// before it can ever silently produce a wrong-value replacement.
//
// GEN-2609-090 - extended with the same check for COLOR_MAP (the new
// "colour" category's exact-hex map, e.g. `--afa-white: #FFF`), since
// migrate-tokens.js's --categories flag can now select it same as any
// dimension category and it deserves the same staleness guardrail.
// FONT_FAMILY_MAP is NOT checked here - it's deliberately empty (see
// migrate-tokens.js's own comment on it), so there is nothing yet that
// could go stale.
//
// Also re-checks every `className=` on the migrated file for the
// GEN-2609-086 Tailwind var()-arbitrary-value ambiguity
// (`text-[var(--x)]` collides between a color and a font-size utility)
// - migrate-tokens.js never touches Tailwind classes at all, so this is
// a defensive check that stays true, not a live risk from this script.
//
// Usage: node scripts/dev/verify-equivalence.js <file...>
const fs = require('fs')
const path = require('path')

const { SPACING_MAP, FONT_SIZE_MAP, RADIUS_MAP, COLOR_MAP } = require('./migrate-tokens')

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: node scripts/dev/verify-equivalence.js <file...>')
  process.exit(1)
}

function loadGlobalsTokens() {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'globals.css'), 'utf8')
  const tokens = {}
  const re = /--afa-(space|text|radius)-([a-zA-Z0-9-]+):\s*([0-9.]+)px\s*;/g
  let m
  while ((m = re.exec(css))) {
    tokens[`--afa-${m[1]}-${m[2]}`] = parseFloat(m[3])
  }
  return tokens
}

// GEN-2609-090 - same idea as loadGlobalsTokens() above, for hex colour
// declarations instead of `Npx` dimensions (a separate loader rather
// than one shared regex, since a colour value's shape - `#` + hex
// digits - has nothing in common with a dimension's `number + unit`).
// Scoped to any `--afa-*` custom property (not just the 3 name prefixes
// above), since colour tokens don't share a single naming convention.
//
// GEN-2609-099 - extended to also capture `rgba(...)`/`rgb(...)`
// declarations, not just hex. Found the gap live: COLOR_MAP only ever
// held one hex entry (--afa-white) until this ticket added 5 rgba
// ones, so this regex's hex-only shape was never exercised against a
// real rgba COLOR_MAP entry before - every one false-flagged as "not
// found in globals.css at all" despite being defined there, simply
// because the loader's regex couldn't match the value shape at all.
// Comparison is whitespace-normalized (strip all spaces before
// comparing) on BOTH sides in checkColorMap() below, since globals.css's
// own convention is spaced (`rgba(245, 245, 240, 0.08)`) while
// COLOR_MAP's keys are unspaced (matching real application code,
// confirmed the unspaced form is the only one that appears there - see
// migrate-tokens.js's own COLOR_MAP comment) - comparing the raw
// strings directly would produce the same false mismatch for a
// different reason (whitespace, not shape).
function loadGlobalsColorTokens() {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'globals.css'), 'utf8')
  const tokens = {}
  const re = /(--afa-[a-zA-Z0-9-]+):\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s*;/g
  let m
  while ((m = re.exec(css))) {
    tokens[m[1]] = m[2]
  }
  return tokens
}

function checkMap(name, map, liveTokens) {
  let ok = true
  for (const [px, token] of Object.entries(map)) {
    const live = liveTokens[token]
    if (live === undefined) {
      console.error(`  MISMATCH [${name}]: ${token} not found in globals.css at all`)
      ok = false
      continue
    }
    if (live !== parseFloat(px)) {
      console.error(`  MISMATCH [${name}]: map says ${px}px -> ${token}, globals.css defines ${token} as ${live}px`)
      ok = false
    }
  }
  return ok
}

// GEN-2609-090 - same purpose as checkMap() above, case-insensitive hex
// string comparison instead of numeric equality (colour values, unlike
// the dimension maps, aren't parsed to a number anywhere in this
// pipeline - see migrate-tokens.js's own migrateExactStringValue()
// comment for why that's deliberate).
function normalizeColorValue(v) {
  return v.replace(/\s+/g, '').toLowerCase()
}

function checkColorMap(name, map, liveColors) {
  let ok = true
  for (const [value, token] of Object.entries(map)) {
    const live = liveColors[token]
    if (live === undefined) {
      console.error(`  MISMATCH [${name}]: ${token} not found in globals.css at all`)
      ok = false
      continue
    }
    if (normalizeColorValue(live) !== normalizeColorValue(value)) {
      console.error(`  MISMATCH [${name}]: map says ${value} -> ${token}, globals.css defines ${token} as ${live}`)
      ok = false
    }
  }
  return ok
}

function checkClassNames(file) {
  const text = fs.readFileSync(file, 'utf8')
  let ok = true
  const re = /className=(?:\{`([^`]*)`\}|"([^"]*)")/g
  let m
  while ((m = re.exec(text))) {
    const cls = m[1] !== undefined ? m[1] : m[2]
    if (/\b(?:text|rounded)-\[var\(/.test(cls)) {
      console.error(`  className ISSUE in ${file}: ambiguous Tailwind var() arbitrary value: ${cls}`)
      ok = false
    }
  }
  return ok
}

const liveTokens = loadGlobalsTokens()
const liveColorTokens = loadGlobalsColorTokens()
let allOk = true
allOk = checkMap('SPACING_MAP', SPACING_MAP, liveTokens) && allOk
allOk = checkMap('FONT_SIZE_MAP', FONT_SIZE_MAP, liveTokens) && allOk
allOk = checkMap('RADIUS_MAP', RADIUS_MAP, liveTokens) && allOk
allOk = checkColorMap('COLOR_MAP', COLOR_MAP, liveColorTokens) && allOk
for (const file of files) {
  allOk = checkClassNames(file) && allOk
}

if (allOk) {
  const mapEntryCount = Object.keys(SPACING_MAP).length + Object.keys(FONT_SIZE_MAP).length + Object.keys(RADIUS_MAP).length + Object.keys(COLOR_MAP).length
  console.log(`verify-equivalence: 0 mismatches (${mapEntryCount} map entries, ${files.length} file(s) className-checked).`)
  process.exit(0)
} else {
  process.exit(1)
}
