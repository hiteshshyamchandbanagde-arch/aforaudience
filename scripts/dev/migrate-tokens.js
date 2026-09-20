// GEN-2609-089 - exact-value token migration script, rebuilt from the
// same design as GEN-2609-086/087/088's own scratch scripts (never
// committed before this session - see docs/design.md's
// verify-equivalence-recurring-bugs finding). Reuses
// check-design-tokens.js's own CSS_PROP_VALUE_RE shape and property-name
// sets so detection can never drift from what the checker/ratchet
// actually count, then applies a position-aware, per-token replacement:
// only a whitespace-separated part of a value that is an EXACT byte
// match for a scale token gets swapped to var(--afa-*), everything else
// (including the rest of a mixed shorthand) is left untouched.
//
// Deliberately NOT a generic tool: no rounding, no calc() awareness
// beyond "the regex below already can't match inside one" (see
// check-design-tokens.js's own CSS_PROP_VALUE_RE comment - a bare
// alternation of "number" or "quoted string" immediately after
// `prop:` can never match `calc(...)`, so calc() text is structurally
// invisible to this script, not specially excluded), and negative
// values are always left literal (negative margins are a real,
// intentional layout technique, never a token-scale value).
//
// Usage:
//   node scripts/dev/migrate-tokens.js <file> [--apply]
//   With no --apply, prints a unified-diff-style dry run to stdout and
//   changes nothing on disk - always review this before re-running with
//   --apply, per every prior batch's own "review before applying" rule.
const fs = require('fs')
const path = require('path')

const file = process.argv[2]
const APPLY = process.argv.includes('--apply')
if (!file) {
  console.error('usage: node scripts/dev/migrate-tokens.js <file> [--apply]')
  process.exit(1)
}

// Same sets as scripts/check-design-tokens.js (not re-exported from
// there, so mirrored here - stable, well-known constants).
const FONT_SIZE_PROPS = new Set(['fontsize'])
const SPACING_PROPS = new Set([
  'padding', 'paddingtop', 'paddingright', 'paddingbottom', 'paddingleft',
  'paddinginline', 'paddingblock', 'paddinginlinestart', 'paddinginlineend',
  'paddingblockstart', 'paddingblockend',
  'margin', 'margintop', 'marginright', 'marginbottom', 'marginleft',
  'margininline', 'marginblock',
  'gap', 'rowgap', 'columngap',
])
const RADIUS_PROPS = new Set([
  'borderradius', 'bordertopleftradius', 'bordertoprightradius',
  'borderbottomleftradius', 'borderbottomrightradius',
])

// Reverse lookup, built directly from src/app/globals.css's live values
// (GEN-2609-077's original scale + GEN-2609-081's px-suffixed
// extension). 0px deliberately excluded from RADIUS_MAP - GEN-2609-079's
// own file-1 entry found that a bare 0 in a mixed-corner radius
// shorthand is structural ("sharp on this joined edge"), not a
// considered token choice, and isAllowlistedLength() already excludes 0
// from ever counting as ratchet debt - migrating it adds a dependency
// for zero benefit. Hairline 1px is excluded from SPACING_MAP for the
// same reason (isAllowlistedLength already treats it as free, and no
// prior batch has ever migrated a hairline).
const SPACING_MAP = {
  2: '--afa-space-2px',
  4: '--afa-space-1',
  6: '--afa-space-6px',
  8: '--afa-space-2',
  10: '--afa-space-10px',
  12: '--afa-space-3',
  14: '--afa-space-14px',
  16: '--afa-space-4',
  18: '--afa-space-18px',
  20: '--afa-space-5',
  24: '--afa-space-6',
  28: '--afa-space-28px',
  32: '--afa-space-32px',
  48: '--afa-space-48px',
}
const FONT_SIZE_MAP = {
  10: '--afa-text-10px',
  11: '--afa-text-micro',
  12: '--afa-text-small',
  13: '--afa-text-ui',
  14: '--afa-text-body',
  15: '--afa-text-15px',
  16: '--afa-text-title',
  18: '--afa-text-18px',
  20: '--afa-text-20px',
  24: '--afa-text-heading',
  28: '--afa-text-page-title',
  32: '--afa-text-page-title-lg',
}
const RADIUS_MAP = {
  6: '--afa-radius-sm',
  8: '--afa-radius-md',
  10: '--afa-radius-10px',
  12: '--afa-radius-12px',
  999: '--afa-radius-pill',
}

function mapFor(normProp) {
  if (FONT_SIZE_PROPS.has(normProp)) return { map: FONT_SIZE_MAP, units: ['px'] }
  if (SPACING_PROPS.has(normProp)) return { map: SPACING_MAP, units: ['px'] }
  if (RADIUS_PROPS.has(normProp)) return { map: RADIUS_MAP, units: ['px'] }
  return null
}

// prop, colon+whitespace, then EITHER a bare number token OR a quoted
// string - same alternation shape as check-design-tokens.js's own
// CSS_PROP_VALUE_RE, with explicit groups so we can compute the exact
// character span of just the VALUE (not the whole `prop: value` match)
// to splice a replacement into the original line without disturbing
// anything else on it.
//
// Bare (unquoted) values need two different widths depending on
// context - a real, previously-undocumented gap found while dry-running
// this script against SiteNav.tsx's raw <style> block: a plain JS
// object literal's bare numeric value is always a single token
// (`fontSize: 14`, terminated by `,`/`}`), but raw CSS text inside a
// `<style>{`...`}</style>` block can have an UNQUOTED multi-value
// shorthand (`padding: 16px 20px !important;`, terminated by `;`/`}`).
// check-design-tokens.js's own CSS_PROP_VALUE_RE has this exact same
// single-token limitation for the bare-value branch (it was written
// assuming JS-object bare values, which are always single tokens) - so
// a value like the trailing `20px` above is invisible to the checker's
// own count too, not just this script. Not fixed there (out of this
// ticket's scope - see docs/design.md's writeup), but fixed here so
// this migration doesn't silently skip real, migratable debt.
const MATCH_RE_JS = /([a-zA-Z-]+)(\s*:\s*)(?:(-?\d+(?:\.\d+)?(?:px|rem|em|%)?)(?=[,;}\s]|$)|(['"`])([^'"`]*)\4)/g
const MATCH_RE_CSS = /([a-zA-Z-]+)(\s*:\s*)(?:(-?\d+(?:\.\d+)?(?:px|rem|em|%)?(?:\s+[a-zA-Z0-9.%!-]+)*)(?=\s*[;}]|$)|(['"`])([^'"`]*)\4)/g

function isCommentLine(line) {
  const t = line.trim()
  return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')
}

function tokenOkReason(line) {
  return /\/\/\s*token-ok:/.test(line) || /\{\/\*\s*token-ok:/.test(line)
}

// Replace exact-match parts of a whitespace-separated value (a single
// value or a multi-value CSS shorthand like "4px 9px"). Returns null if
// nothing in it changed - callers use that to skip a no-op splice.
function migrateValue(raw, map, units, inRawBlock) {
  const parts = raw.split(/(\s+)/) // keep whitespace so we can rejoin exactly
  let changed = false
  const out = parts.map((part) => {
    if (/^\s*$/.test(part)) return part
    if (/^var\(/.test(part)) return part
    const m = /^(-?\d+(?:\.\d+)?)(px|rem|em|%)?$/.exec(part)
    if (!m) return part
    const value = parseFloat(m[1])
    const unit = m[2] || 'px'
    if (value < 0) return part // negative values (e.g. negative margins) always stay literal
    if (!units.includes(unit)) return part
    const key = String(value)
    if (!Object.prototype.hasOwnProperty.call(map, key)) return part
    changed = true
    return `var(${map[key]})`
  })
  if (!changed) return null
  return out.join('')
}

function processLine(line, inRawBlock) {
  if (isCommentLine(line) || tokenOkReason(line)) return line

  const MATCH_RE = inRawBlock ? MATCH_RE_CSS : MATCH_RE_JS
  MATCH_RE.lastIndex = 0
  let m
  // Collect edits first (position-based), then splice back-to-front so
  // earlier offsets stay valid after later-in-line edits.
  const edits = []
  while ((m = MATCH_RE.exec(line))) {
    const propRaw = m[1]
    const norm = propRaw.replace(/-/g, '').toLowerCase()
    const target = mapFor(norm)
    if (!target) continue

    const prefixLen = m[1].length + m[2].length
    if (m[3] !== undefined) {
      // Bare numeric value (unquoted) - e.g. `fontSize: 14` (JS, always
      // a single token) or `padding: 16px 20px !important;` (raw CSS,
      // may be a multi-value shorthand - see MATCH_RE_CSS's own comment).
      const migrated = migrateValue(m[3], target.map, target.units, inRawBlock)
      if (migrated === null) continue
      const start = m.index + prefixLen
      const end = start + m[3].length
      // A bare JS number/px value has no quotes of its own - in a JSX
      // style object it must become a quoted string to hold var(...);
      // inside a raw <style>{`...`}</style> block it stays unquoted
      // CSS text.
      const replacement = inRawBlock ? migrated : `'${migrated}'`
      edits.push({ start, end, replacement })
    } else if (m[5] !== undefined) {
      // Quoted value - may be a single value or a multi-value shorthand.
      const migrated = migrateValue(m[5], target.map, target.units, inRawBlock)
      if (migrated === null) continue
      const start = m.index + prefixLen + 1 // +1 to skip the opening quote
      const end = start + m[5].length
      edits.push({ start, end, replacement: migrated })
    }
  }

  if (edits.length === 0) return line
  let result = line
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, e.start) + e.replacement + result.slice(e.end)
  }
  return result
}

function run() {
  const original = fs.readFileSync(file, 'utf8')
  const lines = original.split('\n')
  let inRawBlock = false
  const out = []
  for (const line of lines) {
    if (inRawBlock && line.includes('`}</style>')) {
      inRawBlock = false
      out.push(line)
      continue
    }
    out.push(processLine(line, inRawBlock))
    if (!inRawBlock && line.includes('<style>{`')) {
      inRawBlock = true
    }
  }
  const migrated = out.join('\n')

  if (!APPLY) {
    let changedLines = 0
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] !== out[i]) {
        changedLines++
        console.log(`--- line ${i + 1} ---`)
        console.log(`- ${lines[i]}`)
        console.log(`+ ${out[i]}`)
      }
    }
    console.log(`\n${changedLines} line(s) would change (dry run - pass --apply to write).`)
    return
  }

  fs.writeFileSync(file, migrated)
  console.log(`applied migration to ${file}`)
}

run()
