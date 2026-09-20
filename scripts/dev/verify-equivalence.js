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
// migrate-tokens.js's 3 hardcoded maps, catching any stale/mistyped
// entry before it can ever silently produce a wrong-value replacement.
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

const { SPACING_MAP, FONT_SIZE_MAP, RADIUS_MAP } = require('./migrate-tokens')

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
let allOk = true
allOk = checkMap('SPACING_MAP', SPACING_MAP, liveTokens) && allOk
allOk = checkMap('FONT_SIZE_MAP', FONT_SIZE_MAP, liveTokens) && allOk
allOk = checkMap('RADIUS_MAP', RADIUS_MAP, liveTokens) && allOk
for (const file of files) {
  allOk = checkClassNames(file) && allOk
}

if (allOk) {
  console.log(`verify-equivalence: 0 mismatches (${Object.keys(SPACING_MAP).length + Object.keys(FONT_SIZE_MAP).length + Object.keys(RADIUS_MAP).length} map entries, ${files.length} file(s) className-checked).`)
  process.exit(0)
} else {
  process.exit(1)
}
