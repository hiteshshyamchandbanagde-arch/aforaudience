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
//   node scripts/dev/migrate-tokens.js <file> [--apply] [--categories=list]
//   With no --apply, prints a unified-diff-style dry run to stdout and
//   changes nothing on disk - always review this before re-running with
//   --apply, per every prior batch's own "review before applying" rule.
//
// GEN-2609-090 - `--categories` restricts which of the 5 defined
// categories (colour, font-size, font-family, radius, spacing) this run
// even looks at. Default is colour+font-size+font-family+radius -
// spacing is excluded by default (see CATEGORY_DEFS/DEFAULT_CATEGORIES
// below and this file's own docs/design.md entry for the "Admin-
// controlled Button/Color/Font/Size first, spacing last" rationale:
// spacing is 2030+ of the ~4,400-literal total but the category least
// relevant to what an Admin actually edits in the design-system panel).
// `--categories=all` opts every category, spacing included, back in -
// same as this script's pre-GEN-2609-090 behavior. Raw `<button>`
// adoption stays entirely outside this script regardless of category
// selection (a shared-component-adoption task, not a value-token swap -
// see docs/design.md's own GEN-2609-089 Phase 2 dispatch).
const fs = require('fs')
const path = require('path')

const file = require.main === module ? process.argv[2] : null
const APPLY = process.argv.includes('--apply')
if (require.main === module && !file) {
  console.error('usage: node scripts/dev/migrate-tokens.js <file> [--apply] [--categories=list]')
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
// GEN-2609-090 - minimal starting set for the new "colour" category,
// scoped to the property names this codebase actually assigns a color
// literal to in a JS style object (see the Task D coverage report this
// ticket's dispatch was built from - every real `#fff`-shaped hit found
// there was a plain `color:`). Intentionally NOT exhaustive (no SVG
// `fill=`/`stroke=` JSX *attribute* support - those are markup
// attributes, not `prop: value` object entries, a structurally different
// shape MATCH_RE_JS/MATCH_RE_CSS was never built to match) - extend this
// set only once a real migration batch needs a prop it doesn't cover.
const COLOR_PROPS = new Set(['color', 'backgroundcolor', 'background', 'bordercolor', 'outlinecolor'])
// GEN-2609-090 - font-family category exists (selectable via
// --categories) for parity with the dispatch's own default-category
// list, but FONT_FAMILY_MAP is deliberately empty: none of this ticket's
// named exact-value tokens are font-family tokens (the 4 --font-* role
// tokens resolve through FONT_ALLOWLIST's curated --font-phys-* aliases
// in src/lib/design-tokens.ts, not a plain exact-string map like this
// script's other 3 categories), and inventing an unrequested mapping
// isn't this ticket's job. Selecting this category is a safe no-op
// until a future ticket actually populates it.
const FONT_FAMILY_PROPS = new Set(['fontfamily'])
const FONT_FAMILY_MAP = {}

// Reverse lookup, built directly from src/app/globals.css's live values
// (GEN-2609-077's original scale + GEN-2609-081's px-suffixed
// extension). Hairline 1px is excluded from SPACING_MAP - isAllowlistedLength
// already treats it as free (never counted ratchet debt), and no prior
// batch has ever migrated a hairline.
//
// GEN-2609-090 - `0: '--afa-radius-sharp'` was PREVIOUSLY deliberately
// excluded here (GEN-2609-079's own file-1 entry: a bare 0 in a mixed-
// corner radius shorthand is usually structural - "sharp on this joined
// edge" - not a considered token choice, and isAllowlistedLength()
// already excludes 0 from ever counting as ratchet debt, so migrating it
// doesn't move that number). That reasoning is still true as a caveat,
// not a reason to withhold it: this ticket's own dispatch explicitly
// named `--afa-radius-sharp` as one of 8 exact-value tokens to wire the
// tooling up for, so a literal `0`/`0px` borderRadius value IS a
// legitimate migration target now, ratchet-invisible or not - the two
// concerns (does the ratchet count move, is this a real token adoption)
// are separate questions, and this ticket only asked about the second.
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
  0: '--afa-radius-sharp',
  6: '--afa-radius-sm',
  8: '--afa-radius-md',
  10: '--afa-radius-10px',
  12: '--afa-radius-12px',
  999: '--afa-radius-pill',
}
// GEN-2609-090 - exact-string colour map (case-insensitive key lookup,
// see migrateExactStringValue()), same "byte/value-identical only" convention
// as the 3 dimension maps above and as check-design-tokens.js's own
// GEN-2609-057 relocated-literal check: `#FFF` matches `'#fff'`/`'#FFF'`
// but NOT the visually-identical `#FFFFFF` (a different literal string),
// and never the 6-digit expansion of any other unused colour token
// either - no colour-space normalization, deliberately.
//
// GEN-2609-099 - 5 rgba() entries added, same byte-identical convention.
// Checked before assuming it: migrateExactStringValue()'s case-
// insensitive lookup handles hex's only real-world variance (`#fff` vs
// `#FFF`), but rgba has a DIFFERENT variance - internal whitespace
// (`rgba(245,245,240,0.65)` vs `rgba(245, 245, 240, 0.65)`) - that
// lookup does nothing for. Measured before adding these keys: the
// spaced form appears ONLY in globals.css/design-tokens.ts (the
// definition sites, both EXEMPT_FILES) - zero occurrences anywhere in
// real application code. So a single unspaced-form key per value is
// sufficient today; no normalization added to migrateExactStringValue()
// itself, since that would be a broader behavior change than this
// ticket's 5 known values need. If a spaced form ever appears in
// application code in the future, add it as its own key here (same
// "byte/value-identical only" convention), not by changing the matcher.
const COLOR_MAP = {
  '#FFF': '--afa-white',
  'rgba(245,245,240,0.65)': '--afa-text-secondary',
  'rgba(245,245,240,0.4)': '--afa-text-muted',
  'rgba(245,245,240,0.15)': '--afa-border-resting',
  'rgba(245,245,240,0.08)': '--afa-tint-08',
  'rgba(245,245,240,0.1)': '--afa-tint-10',
}

// GEN-2609-090 - one definition per --categories name, so `mapFor()` can
// be restricted to only the categories a given run selected (see this
// file's header comment on --categories/DEFAULT_CATEGORIES/ALL_CATEGORIES
// below). `kind` picks which value-matcher processLine() runs: 'dimension'
// for the numeric px/rem maps (existing migrateValue()), 'exact-string'
// for a quoted-value-only exact map-key lookup (migrateExactStringValue()
// - shared by colour's hex map and font-family's - currently empty - map,
// since both are "this precise string or nothing," never a numeric parse.
// Quoted values only; see that function's own comment for the unquoted-
// raw-CSS-hex gap this doesn't cover).
const CATEGORY_DEFS = {
  colour: { props: COLOR_PROPS, map: COLOR_MAP, kind: 'exact-string' },
  'font-size': { props: FONT_SIZE_PROPS, map: FONT_SIZE_MAP, kind: 'dimension', units: ['px'] },
  'font-family': { props: FONT_FAMILY_PROPS, map: FONT_FAMILY_MAP, kind: 'exact-string' },
  radius: { props: RADIUS_PROPS, map: RADIUS_MAP, kind: 'dimension', units: ['px'] },
  spacing: { props: SPACING_PROPS, map: SPACING_MAP, kind: 'dimension', units: ['px'] },
}
const ALL_CATEGORIES = Object.keys(CATEGORY_DEFS)
// GEN-2609-090 - the dispatch's own ranking: an Admin edits Button/Color/
// Font/Size in /dashboard/admin/design-system - spacing isn't one of the
// controls there and is 2,055 of the ~4,400-literal total (see
// docs/design.md's own GEN-2609-090 entry for the full rationale) -
// least relevant to what changing a token in Admin actually affects, so
// it's excluded from the default set and opted back in only via
// `--categories=all`.
const DEFAULT_CATEGORIES = ['colour', 'font-size', 'font-family', 'radius']

function parseCategories(argv) {
  const arg = argv.find((a) => a.startsWith('--categories='))
  if (!arg) return DEFAULT_CATEGORIES
  const raw = arg.slice('--categories='.length)
  if (raw === 'all') return ALL_CATEGORIES
  const requested = raw.split(',').map((s) => s.trim()).filter(Boolean)
  for (const c of requested) {
    if (!CATEGORY_DEFS[c]) {
      console.error(`unknown category "${c}" - valid categories: ${ALL_CATEGORIES.join(', ')}, or "all"`)
      process.exit(1)
    }
  }
  return requested
}

function buildActiveDefs(categories) {
  return categories.map((c) => CATEGORY_DEFS[c])
}

function mapFor(normProp, activeDefs) {
  for (const def of activeDefs) {
    if (def.props.has(normProp)) return def
  }
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

// GEN-2609-090 - exact-string match for the 'exact-string' categories
// (colour's hex map, font-family's - currently empty - map): a single,
// whole value, never a whitespace-split shorthand (unlike migrateValue()
// above - `color`/`backgroundColor`/etc. never take a multi-value CSS
// shorthand the way `padding`/`borderRadius` can). Case-insensitive key
// lookup only ('#fff' matches map key '#FFF') - no other normalization,
// same "byte/value-identical or leave it" convention as migrateValue().
//
// Quoted values only (m[5] in processLine, never m[3]): a hex colour
// starts with `#`, never a digit, so it can never satisfy MATCH_RE_JS/
// MATCH_RE_CSS's bare-numeric alternative in the first place - an
// unquoted raw-CSS colour (`color: #fff;` with no quotes, inside a
// `<style>{`...`}</style>` block) is real CSS but structurally
// unreachable by either regex's bare-value branch as written, a known
// gap left for a future ticket, not silently worked around here.
function migrateExactStringValue(raw, map) {
  const key = Object.keys(map).find((k) => k.toLowerCase() === raw.trim().toLowerCase())
  if (!key) return null
  return `var(${map[key]})`
}

function processLine(line, inRawBlock, activeDefs) {
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
    const target = mapFor(norm, activeDefs)
    if (!target) continue

    const prefixLen = m[1].length + m[2].length
    if (target.kind === 'exact-string') {
      if (m[5] === undefined) continue // bare numeric branch never applies to a colour/font-family value
      const migrated = migrateExactStringValue(m[5], target.map)
      if (migrated === null) continue
      const start = m.index + prefixLen + 1 // +1 to skip the opening quote
      const end = start + m[5].length
      edits.push({ start, end, replacement: migrated })
      continue
    }
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
  const categories = parseCategories(process.argv)
  const activeDefs = buildActiveDefs(categories)
  console.log(`categories: ${categories.join(', ')}`)

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
    out.push(processLine(line, inRawBlock, activeDefs))
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

if (require.main === module) {
  run()
}

module.exports = {
  SPACING_MAP,
  FONT_SIZE_MAP,
  RADIUS_MAP,
  COLOR_MAP,
  FONT_FAMILY_MAP,
  CATEGORY_DEFS,
  DEFAULT_CATEGORIES,
  ALL_CATEGORIES,
  parseCategories,
}
