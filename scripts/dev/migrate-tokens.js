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
const COLOR_PROPS = new Set(['color', 'backgroundcolor', 'background', 'bordercolor', 'outlinecolor', 'bg', 'fill'])
// GEN-2609-100 - `bg`/`fill` added to the set above: found live via the
// GEN-2609-093/099 audit's own "why did only 49 of ~371 estimated rgba
// sites convert" investigation - a repo-wide grep of every real
// occurrence of a COLOR_MAP value, classified by its exact surrounding
// property name (not assumed). Both are bare, non-shorthand colour
// values under a non-standard-CSS property name this script's
// COLOR_PROPS set never covered: `bg` is this codebase's own convention
// for a status/tone-role map key (`STATUS_TONE = { muted: { bg: 'rgba(...)',
// color: '...' } }`, not a DOM style prop at all - the value is still
// the WHOLE string though, so exact-string matching applies unchanged),
// `fill` is Recharts' tick-style prop (`tick={{ fill: 'rgba(...)', ... }}`).
// Both measured before adding: 7 and 4 real sites respectively.
//
// GEN-2609-100 - the SAME investigation found the actual dominant gap
// (~270 of ~320 missed sites): `border`/`borderTop`/`borderBottom`/etc
// and `outline`/`boxShadow` are CSS SHORTHAND properties - their value
// is never just a colour, it's `"<width> <style> <colour>"` (e.g.
// `border: '1px solid rgba(245,245,240,0.08)'`) or, for `boxShadow`,
// `"<offsets> <blur> <colour>"`. `migrateExactStringValue()`'s whole-
// string-only comparison can never match these (the whole string isn't
// a COLOR_MAP key, just a piece of it is) - structurally the same
// "shorthand" problem `migrateValue()` already solves for
// `border-radius`/`padding`/etc, but those are all whitespace-split
// NUMERIC parts; a colour value like `rgba(245,245,240,0.08)` contains
// its own internal commas and can't be found by a naive
// whitespace-split lookup. See COMPOUND_COLOR_PROPS/
// migrateCompoundStringValue() below for the dedicated fix, and
// docs/design.md's own GEN-2609-100 entry for the full occurrence
// breakdown (dominant `border`-family: ~270; `boxShadow`: 2).
//
// GEN-2609-100 deliberately left 3 further gaps uncovered, of which 2
// are now also closed (see docs/design.md's GEN-2609-101/102 entries):
// Tailwind arbitrary-value brackets like `border-[rgba(...)]` inside a
// `className="..."` string - an `attr="value"` JSX attribute, not a
// `prop: value` pair, so MATCH_RE_JS/CSS's colon-based matching could
// never reach it - GEN-2609-101 added a dedicated className-scoped
// regex (see MATCH_RE_JSX_CLASSNAME below) that reuses
// migrateCompoundStringValue() unchanged, since a className string is
// itself just another "compound value with one small literal substring
// worth replacing," the exact same shape a `border` shorthand already
// is; and an UNQUOTED colour value inside a raw `<style>{`...`}</style>`
// block, e.g. `color: rgba(245,245,240,0.4);` with no quotes -
// GEN-2609-102 added MATCH_RE_CSS_RAW_COLOR (see below) specifically
// for this, again reusing migrateExactStringValue()/
// migrateCompoundStringValue() unchanged. Still NOT covered, and out of
// scope for both those tickets: a JSX `fill="..."`/`stroke="..."` SVG
// attribute - same `attr="value"` shape as className, but this
// codebase's only 5 known sites are the hardcoded Google-brand-logo
// paths (already `token-ok:`'d) and one `icon.svg` file that isn't a
// `.ts(x)` file at all, so there's no real site left to wire up; adding
// general SVG-attribute support for zero real sites isn't worth the
// risk of a generic `fill="..."` matcher misfiring on an unrelated
// attribute somewhere else in the tree.
const COMPOUND_COLOR_PROPS = new Set([
  'border', 'bordertop', 'borderbottom', 'borderleft', 'borderright',
  'borderinlinestart', 'borderinlineend', 'outline', 'boxshadow',
])
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
// GEN-2609-106 - font-size closeout, per Hitesh's delegated decision
// ("go ahead with your planning"): renamed the 4 pixel-named keys to
// their new semantic names (matching globals.css/design-tokens.ts's
// own GEN-2609-106 rename), added --afa-text-subheading (22px, new),
// and added the approved rounding entries - each an off-scale value
// close enough to an existing scale step that it's now DEFINED as
// that step, not a new token of its own: 9/9.5->10 (caption),
// 10.5->11 (micro), 11.5->12 (small), 12.5->13 (ui), 13.5->14 (body),
// 17->16 (title, the "default to 16" decision - measured per-site
// first via docs/design.md's GEN-2609-106 entry, no override sites
// found), 19->20 (subtitle, same "default" treatment). Display sizes
// (26px+) and non-px units (rem/em/%/clamp()) are explicitly NOT
// covered here - stay literal per the same decision.
const FONT_SIZE_MAP = {
  9: '--afa-text-caption',
  9.5: '--afa-text-caption',
  10: '--afa-text-caption',
  10.5: '--afa-text-micro',
  11: '--afa-text-micro',
  11.5: '--afa-text-small',
  12: '--afa-text-small',
  12.5: '--afa-text-ui',
  13: '--afa-text-ui',
  13.5: '--afa-text-body',
  14: '--afa-text-body',
  15: '--afa-text-body-lg',
  16: '--afa-text-title',
  17: '--afa-text-title',
  18: '--afa-text-lead',
  19: '--afa-text-subtitle',
  20: '--afa-text-subtitle',
  22: '--afa-text-subheading',
  24: '--afa-text-heading',
  28: '--afa-text-page-title',
  32: '--afa-text-page-title-lg',
}
// GEN-2609-106 - the 8 FONT_SIZE_MAP keys above that are deliberate
// ROUNDS (not exact-value matches) to their target token - verify-
// equivalence.js's checkMap() exact-equality check predates this
// decision and would otherwise flag every one of these as a stale/
// mistyped map entry forever (9px really does map to a 10px token on
// purpose). Exported so that script can skip exact-equality for just
// these keys while still requiring the target token to exist in
// globals.css at all - a genuine typo (token renamed/removed, or an
// unrelated key pointing at the wrong token entirely) still fails.
const FONT_SIZE_ROUNDED_KEYS = new Set(['9', '9.5', '10.5', '11.5', '12.5', '13.5', '17', '19'])
// GEN-2609-112 - exact-value entries only, one per step of the final
// 8-step radius scale (docs/decisions/2026-09-26-radius-colour-scale.md
// section 1). --afa-radius-10px is retired and --afa-radius-12px renamed
// to lg, so 10 is no longer an exact match for anything - off-scale
// values live in RADIUS_ROUND below, never here, so verify-equivalence.js
// can keep this map to "byte/value-identical" entries only.
const RADIUS_MAP = {
  0: '--afa-radius-sharp',
  3: '--afa-radius-xs',
  6: '--afa-radius-sm',
  8: '--afa-radius-md',
  12: '--afa-radius-lg',
  16: '--afa-radius-xl',
  20: '--afa-radius-2xl',
  999: '--afa-radius-pill',
}
// GEN-2609-112 - off-scale radius values, each DEFINED as its nearest
// scale step by the decision record (never an exact-value match, which
// is why this is separate from RADIUS_MAP: verify-equivalence.js reports
// every site converted through here as an intentional value change).
const RADIUS_ROUND = {
  2: '--afa-radius-xs',
  4: '--afa-radius-xs',
  5: '--afa-radius-sm',
  7: '--afa-radius-sm',
  10: '--afa-radius-lg',
  14: '--afa-radius-lg',
  24: '--afa-radius-2xl',
  99: '--afa-radius-pill',
}

// GEN-2609-112 - lookup for the Tailwind radius-bracket pass, same
// map-then-round order as migrateValue().
function radiusTokenFor(value, def) {
  if (value < 0) return null
  const key = String(value)
  if (Object.prototype.hasOwnProperty.call(def.map, key)) return def.map[key]
  if (def.round && Object.prototype.hasOwnProperty.call(def.round, key)) return def.round[key]
  return null
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
//
// GEN-2609-113 - one exact entry per new colour token (decision record
// section 2). `rgba(245,245,240,0.4)` left this map: --afa-text-muted is
// now 0.5, so 0.4 is a ROUND (see COLOR_ROUND below), not an equivalence.
const COLOR_MAP = {
  '#FFF': '--afa-white',
  'rgba(245,245,240,0.65)': '--afa-text-secondary',
  'rgba(245,245,240,0.5)': '--afa-text-muted',
  'rgba(245,245,240,0.8)': '--afa-text-soft',
  'rgba(245,245,240,0.15)': '--afa-border-resting',
  'rgba(245,245,240,0.04)': '--afa-tint-04',
  'rgba(245,245,240,0.06)': '--afa-tint-06',
  'rgba(245,245,240,0.08)': '--afa-tint-08',
  'rgba(245,245,240,0.1)': '--afa-tint-10',
  'rgba(245,245,240,0.12)': '--afa-tint-12',
  'rgba(245,245,240,0.2)': '--afa-tint-20',
  'rgba(245,245,240,0.3)': '--afa-tint-30',
  'rgba(201,151,58,0.08)': '--afa-amber-wash',
  'rgba(201,151,58,0.15)': '--afa-amber-tint',
  'rgba(201,151,58,0.4)': '--afa-amber-border',
  'rgba(201,151,58,0.6)': '--afa-amber-strong',
  'rgba(179,38,30,0.1)': '--afa-error-tint',
  'rgba(179,38,30,0.3)': '--afa-error-edge',
  'rgba(74,103,65,0.12)': '--afa-sage-tint',
  'rgba(39,103,73,0.15)': '--afa-success-tint',
  'rgba(255,90,54,0.2)': '--afa-fill-tint',
  'rgba(74,111,165,0.15)': '--afa-blue-tint',
  'rgba(0,0,0,0.3)': '--afa-shadow',
  'rgba(10,10,10,0.7)': '--afa-scrim',
  'rgba(10,10,10,0.9)': '--afa-scrim-strong',
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
  // GEN-2609-100 - `props` widened to also include COMPOUND_COLOR_PROPS
  // (border/outline/boxShadow) so mapFor() recognizes them as belonging
  // to the 'colour' category at all; `compoundProps` (checked first in
  // processLine(), before `kind`) is what actually routes those specific
  // property names to migrateCompoundStringValue() instead of the
  // category's own default 'exact-string' kind - see COMPOUND_COLOR_PROPS'
  // own comment above for why they need different handling.
  colour: {
    props: new Set([...COLOR_PROPS, ...COMPOUND_COLOR_PROPS]),
    map: COLOR_MAP,
    kind: 'exact-string',
    compoundProps: COMPOUND_COLOR_PROPS,
  },
  'font-size': { props: FONT_SIZE_PROPS, map: FONT_SIZE_MAP, kind: 'dimension', units: ['px'] },
  'font-family': { props: FONT_FAMILY_PROPS, map: FONT_FAMILY_MAP, kind: 'exact-string' },
  radius: { props: RADIUS_PROPS, map: RADIUS_MAP, round: RADIUS_ROUND, kind: 'dimension', units: ['px'] },
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

// GEN-2609-102 - a second, deliberately separate regex for raw
// `<style>{`...`}</style>` CSS text, run ONLY for colour-category
// property names (checked via mapFor() in processLine(), same as every
// other path). An unquoted colour value - `color: rgba(245,245,240,0.4);`
// or a compound `border: 1px solid rgba(245,245,240,0.1);` - can never
// satisfy MATCH_RE_CSS's own bare-numeric branch: that branch requires
// the value to START with a digit (`-?\d+...`), which neither `#`
// (hex) nor `r` (of `rgba(`) ever do, and even the compound case's
// leading `1px solid` prefix can't extend into `rgba(...)` because the
// branch's own continuation-token class (`[a-zA-Z0-9.%!-]+`) excludes
// parentheses and commas - so these declarations were entirely
// INVISIBLE to MATCH_RE_CSS, not merely unmatched-then-skipped (measured
// live: a repo-wide raw-<style>-block scan found 3 whole-value sites
// and 7 more embedded in a `border:`/`border-top:` shorthand, 10 total
// across 8 files - see docs/design.md's GEN-2609-102 entry for the
// full breakdown against the ticket's own 2-site estimate).
//
// This regex captures the raw text between a property's `:` and its
// own `;`/`}` terminator - colour values never contain either
// character, so that terminator is always exact, letting `[^;{}]+?`
// safely span internal commas/parens a numeric-only branch never could.
// It is intentionally NOT restricted to colour-shaped text at the
// regex level (it will also match `padding: 16px 20px;`,
// `display: flex;`, etc.) - processLine() below filters to colour-
// category props only via the same mapFor() lookup every other path
// uses, so a non-colour match is just a harmless, discarded candidate,
// never touched or reported as an edit.
const MATCH_RE_CSS_RAW_COLOR = /([a-zA-Z-]+)(\s*:\s*)([^;{}]+?)(?=\s*[;}])/g

// GEN-2609-101 - Tailwind arbitrary-value colour brackets inside a
// `className="..."` JSX attribute (e.g. `border-[rgba(245,245,240,0.08)]`)
// are `attr="value"` syntax (`=`, not `:`) - structurally unreachable by
// MATCH_RE_JS/MATCH_RE_CSS, both of which only match colon-based
// `prop: value` pairs. Scoped to `className` specifically (the only
// attribute this codebase's known sites use) rather than a generic
// `attr="..."` matcher, to avoid ever touching an unrelated JSX
// attribute by accident. Same "no nested quotes" assumption MATCH_RE_JS's
// own quoted-value group already makes (a className string never
// contains a literal `"`/`'`).
const MATCH_RE_JSX_CLASSNAME = /\bclassName=(["'])([^"']*)\1/g

// GEN-2609-105 - Tailwind arbitrary-value FONT-SIZE bracket inside a
// className="..." JSX attribute (e.g. `text-[28px]`) - structurally the
// same className-only gap GEN-2609-101 closed for colour
// (MATCH_RE_JS/MATCH_RE_CSS only match colon-based `prop: value` pairs,
// never `attr="value"` JSX syntax), but NOT handled by reusing
// migrateCompoundStringValue()/COLOR_MAP the way -101 did: a font-size
// bracket's value is a bare dimension (`28px`), not a substring to
// splice inside a larger string, so it needs its own whole-bracket
// replacement, same shape as migrateValue()'s dimension lookup but
// applied to `text-[Npx]` instead of a `prop: value` pair.
//
// Replacement is `text-[length:var(--afa-token)]`, NEVER the bare
// `text-[var(--afa-token)]` form colour's own matcher produces -
// empirically verified via the real installed Tailwind CLI (v4.3.3,
// same toolchain check as GEN-2609-101/BUG-2609-057): an UNHINTED
// `text-[var(--afa-text-page-title)]` compiles to
// `color: var(--afa-text-page-title)`, not `font-size:` - Tailwind v4's
// own type-inference for a bare var() reference defaults to colour
// regardless of the variable's actual name, so reusing colour's plain
// form here would silently break font-size (`color: 28px` is invalid,
// the declaration is dropped, and the text falls back to its
// inherited/default size - not visually obvious). The explicit
// `length:` type-hint (mirroring colour's own `color:` hint from
// BUG-2609-057) makes Tailwind's inference unambiguous by construction;
// re-verified same-session that `text-[length:var(--afa-text-page-title)]`
// does compile to `font-size: var(--afa-text-page-title)`.
const MATCH_RE_TW_FONTSIZE_BRACKET = /\btext-\[(-?\d+(?:\.\d+)?)(px|rem)\]/g

// px-only, mirroring CATEGORY_DEFS['font-size'].units - the dimension
// matcher's own unit scope, and matching every real site found (no rem
// bracket site exists in this codebase as of GEN-2609-105's own
// measurement).
function migrateTailwindFontSizeBracket(raw, map, units) {
  MATCH_RE_TW_FONTSIZE_BRACKET.lastIndex = 0
  let changed = false
  const result = raw.replace(MATCH_RE_TW_FONTSIZE_BRACKET, (whole, numStr, unit) => {
    const value = parseFloat(numStr)
    if (value < 0) return whole // negative values always stay literal, same convention as migrateValue()
    if (!units.includes(unit)) return whole
    const key = String(value)
    if (!Object.prototype.hasOwnProperty.call(map, key)) return whole
    changed = true
    return `text-[length:var(${map[key]})]`
  })
  if (!changed) return null
  return result
}

// GEN-2609-112 - Tailwind arbitrary-value RADIUS bracket inside a
// className="..." attribute (`rounded-[16px]`, `rounded-t-[8px]`) - same
// className-only gap GEN-2609-105 closed for font-size, and the same
// side-prefix shape check-design-tokens.js's own radius-literal rule
// counts (`rounded(?:-[tbrl]{1,2})?-[Npx]`). Unlike `text-[...]`, a bare
// `rounded-[var(...)]` is NOT ambiguous: `rounded-*` has only one
// arbitrary-value type (border-radius), no colour utility shares the
// prefix. Verified with the installed @tailwindcss/node compile():
// `rounded-[var(--afa-radius-xl)]` -> `border-radius: var(--afa-radius-xl)`,
// so no `length:` hint is added.
const MATCH_RE_TW_RADIUS_BRACKET = /\b(rounded(?:-[tbrl]{1,2})?)-\[(-?\d+(?:\.\d+)?)(px)\]/g

function migrateTailwindRadiusBracket(raw, def) {
  MATCH_RE_TW_RADIUS_BRACKET.lastIndex = 0
  let changed = false
  const result = raw.replace(MATCH_RE_TW_RADIUS_BRACKET, (whole, utility, numStr) => {
    const token = radiusTokenFor(parseFloat(numStr), def)
    if (!token) return whole
    changed = true
    return `${utility}-[var(${token})]`
  })
  if (!changed) return null
  return result
}

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
//
// GEN-2609-112 - `bareJsNumber`: a unitless number is only px when it is
// a bare JS number in a style object (`borderRadius: 12` - React appends
// px). Unitless text inside a quoted string (`borderRadius: '12'`) or a
// raw <style> block (`border-radius: 12;`) is invalid CSS the browser
// drops, so converting it to a var() would CHANGE the rendering, not
// preserve it - left literal. 0 is the one unitless length CSS accepts
// everywhere, so it is always allowed (the `"8px 8px 0 0"` shorthand).
//
// GEN-2609-112 - `round` (optional) is a category's rounding map
// (RADIUS_ROUND), consulted only after an exact `map` miss.
function migrateValue(raw, map, units, bareJsNumber, round) {
  const parts = raw.split(/(\s+)/) // keep whitespace so we can rejoin exactly
  let changed = false
  const out = parts.map((part) => {
    if (/^\s*$/.test(part)) return part
    if (/^var\(/.test(part)) return part
    const m = /^(-?\d+(?:\.\d+)?)(px|rem|em|%)?$/.exec(part)
    if (!m) return part
    const value = parseFloat(m[1])
    if (!m[2] && value !== 0 && !bareJsNumber) return part
    const unit = m[2] || 'px'
    if (value < 0) return part // negative values (e.g. negative margins) always stay literal
    if (!units.includes(unit)) return part
    const key = String(value)
    const token = Object.prototype.hasOwnProperty.call(map, key)
      ? map[key]
      : round && Object.prototype.hasOwnProperty.call(round, key) ? round[key] : null
    if (!token) return part
    changed = true
    return `var(${token})`
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
// Quoted values only (m[5] in processLine, never m[3]) via the MAIN
// MATCH_RE_JS/MATCH_RE_CSS pass: a hex colour starts with `#`, never a
// digit, so it can never satisfy either regex's bare-numeric
// alternative there. GEN-2609-102 reaches the unquoted-raw-CSS case
// (`color: #fff;`/`color: rgba(...);` with no quotes, inside a
// `<style>{`...`}</style>` block) through a SEPARATE regex
// (MATCH_RE_CSS_RAW_COLOR below) that still calls this same function -
// this function itself is unchanged; only processLine() gained a new
// caller for it.
function migrateExactStringValue(raw, map) {
  const key = Object.keys(map).find((k) => k.toLowerCase() === raw.trim().toLowerCase())
  if (!key) return null
  return `var(${map[key]})`
}

// GEN-2609-100 - shorthand counterpart to migrateExactStringValue()
// above, for COMPOUND_COLOR_PROPS (border/outline/boxShadow): finds
// each COLOR_MAP key as an exact-text occurrence ANYWHERE inside a
// larger compound string (`"1px solid rgba(245,245,240,0.08)"`) and
// splices in `var(--token)` in its place, leaving the rest of the
// shorthand (width, style, other shadow layers) untouched - same
// "byte/value-identical or leave it" convention as every other matcher
// in this file, just located by substring search instead of whole-
// string equality. Supports multiple, non-overlapping matches in one
// value (a multi-layer `boxShadow` can have 2+ colours); returns null
// (a full no-op, same convention as migrateValue()/migrateExactStringValue())
// if nothing in the map is found.
//
// Case-insensitive search (mirrors migrateExactStringValue()'s own
// case-insensitive whole-string lookup) - matters only for a hex key
// like '#FFF' (a colour author could write '#fff' inline); an rgba key
// has no letters to vary case on besides the literal word "rgba"
// itself, which this codebase has never written any other way, but the
// case-insensitive search costs nothing extra to also cover it.
//
// Boundary guard: after finding a hex key's text (e.g. '#FFF') inside
// the raw string, the very next character must NOT be another hex
// digit - otherwise '#FFF' would wrongly self-match as a prefix of the
// visually-DIFFERENT, longer literal '#FFFFFF' (exactly the same
// "distinct literal, not a colour-space equivalence" guarantee
// COLOR_MAP's own header comment already documents for the whole-
// string case). An rgba key is inherently self-terminating (it always
// ends in the literal character ')'), so no equivalent chance exists
// there - the parenthesis makes '...0.1)' structurally unable to match
// inside '...0.15)' (the character immediately after '0.1' would have
// to be ')' for a match, but '...0.15)' has '5' there instead) - no
// extra guard is needed or added for that shape.
function migrateCompoundStringValue(raw, map) {
  const keys = Object.keys(map).sort((a, b) => b.length - a.length)
  const found = []
  for (const key of keys) {
    const lowerRaw = raw.toLowerCase()
    const lowerKey = key.toLowerCase()
    const isHex = key.startsWith('#')
    let searchFrom = 0
    while (true) {
      const idx = lowerRaw.indexOf(lowerKey, searchFrom)
      if (idx === -1) break
      const end = idx + key.length
      if (isHex && /[0-9a-fA-F]/.test(raw[end] || '')) {
        searchFrom = idx + 1 // prefix of a longer hex code - not a real match, keep scanning past it
        continue
      }
      // Skip if this span overlaps a match already recorded for a
      // different (earlier-checked, longer) key - longer keys are
      // tried first via the length-descending sort above specifically
      // so a more specific match always wins a genuine overlap.
      if (found.some((f) => idx < f.end && end > f.start)) {
        searchFrom = idx + 1
        continue
      }
      found.push({ start: idx, end, token: map[key] })
      searchFrom = end
    }
  }
  if (found.length === 0) return null
  found.sort((a, b) => a.start - b.start)
  let result = ''
  let cursor = 0
  for (const f of found) {
    result += raw.slice(cursor, f.start) + `var(${f.token})`
    cursor = f.end
  }
  result += raw.slice(cursor)
  return result
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
    // GEN-2609-100 - checked BEFORE `target.kind === 'exact-string'`
    // deliberately: `compoundProps` is a per-PROPERTY override within
    // the 'colour' category (whose category-level `kind` stays
    // 'exact-string' for its other props like `color`/`background`) -
    // a property in this set always needs the shorthand-aware matcher
    // regardless of what its category's default kind says.
    if (target.compoundProps && target.compoundProps.has(norm)) {
      if (m[5] === undefined) continue // bare numeric branch never applies - see migrateCompoundStringValue()'s own header for the unquoted-raw-CSS gap this leaves
      const migrated = migrateCompoundStringValue(m[5], target.map)
      if (migrated === null) continue
      const start = m.index + prefixLen + 1 // +1 to skip the opening quote
      const end = start + m[5].length
      edits.push({ start, end, replacement: migrated })
      continue
    }
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
      const migrated = migrateValue(m[3], target.map, target.units, !inRawBlock, target.round)
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
      const migrated = migrateValue(m[5], target.map, target.units, false, target.round)
      if (migrated === null) continue
      const start = m.index + prefixLen + 1 // +1 to skip the opening quote
      const end = start + m[5].length
      edits.push({ start, end, replacement: migrated })
    }
  }

  // GEN-2609-102 - second pass, raw <style> blocks only: catches the
  // unquoted-colour declarations the main loop above structurally can't
  // (see MATCH_RE_CSS_RAW_COLOR's own header). Runs after the main loop
  // so `edits` already reflects it, letting the overlap guard below
  // avoid ever double-editing the same span (belt-and-braces - in
  // practice the two loops never target the same characters, since
  // anything the main loop already caught wouldn't still be unmatched
  // colour text here).
  if (inRawBlock && activeDefs.includes(CATEGORY_DEFS.colour)) {
    MATCH_RE_CSS_RAW_COLOR.lastIndex = 0
    let cm
    while ((cm = MATCH_RE_CSS_RAW_COLOR.exec(line))) {
      const norm = cm[1].replace(/-/g, '').toLowerCase()
      const target = mapFor(norm, activeDefs)
      if (target !== CATEGORY_DEFS.colour) continue
      const rawValue = cm[3]
      if (/^var\(/i.test(rawValue.trim())) continue // already a token, nothing to do
      const prefixLen = cm[1].length + cm[2].length
      const start = cm.index + prefixLen
      const end = start + rawValue.length
      if (edits.some((e) => start < e.end && end > e.start)) continue
      const migrated = target.compoundProps && target.compoundProps.has(norm)
        ? migrateCompoundStringValue(rawValue, target.map)
        : migrateExactStringValue(rawValue, target.map)
      if (migrated === null) continue
      edits.push({ start, end, replacement: migrated })
    }
  }

  // GEN-2609-101 - className-only pass, never inside a raw <style>
  // block (a className attribute can't appear there). Reuses
  // migrateCompoundStringValue() directly against the whole className
  // string, same substring-splice behaviour a `border`/`boxShadow`
  // shorthand already gets - a className string IS just another
  // compound value with one small literal substring worth replacing.
  if (!inRawBlock && activeDefs.includes(CATEGORY_DEFS.colour)) {
    MATCH_RE_JSX_CLASSNAME.lastIndex = 0
    let jm
    while ((jm = MATCH_RE_JSX_CLASSNAME.exec(line))) {
      const rawValue = jm[2]
      const migrated = migrateCompoundStringValue(rawValue, COLOR_MAP)
      if (migrated === null) continue
      const start = jm.index + jm[0].indexOf(rawValue)
      const end = start + rawValue.length
      if (edits.some((e) => start < e.end && end > e.start)) continue
      edits.push({ start, end, replacement: migrated })
    }
  }

  // GEN-2609-105 - font-size className-bracket pass, same
  // never-inside-a-raw-<style>-block scoping as colour's className pass
  // above (a className attribute can't appear there either).
  if (!inRawBlock && activeDefs.includes(CATEGORY_DEFS['font-size'])) {
    MATCH_RE_JSX_CLASSNAME.lastIndex = 0
    let jm
    while ((jm = MATCH_RE_JSX_CLASSNAME.exec(line))) {
      const rawValue = jm[2]
      const migrated = migrateTailwindFontSizeBracket(rawValue, FONT_SIZE_MAP, CATEGORY_DEFS['font-size'].units)
      if (migrated === null) continue
      const start = jm.index + jm[0].indexOf(rawValue)
      const end = start + rawValue.length
      if (edits.some((e) => start < e.end && end > e.start)) continue
      edits.push({ start, end, replacement: migrated })
    }
  }

  // GEN-2609-112 - radius className-bracket pass, same scoping as the
  // font-size one above.
  if (!inRawBlock && activeDefs.includes(CATEGORY_DEFS.radius)) {
    MATCH_RE_JSX_CLASSNAME.lastIndex = 0
    let jm
    while ((jm = MATCH_RE_JSX_CLASSNAME.exec(line))) {
      const rawValue = jm[2]
      const migrated = migrateTailwindRadiusBracket(rawValue, CATEGORY_DEFS.radius)
      if (migrated === null) continue
      const start = jm.index + jm[0].indexOf(rawValue)
      const end = start + rawValue.length
      if (edits.some((e) => start < e.end && end > e.start)) continue
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
  RADIUS_ROUND,
  COLOR_MAP,
  FONT_FAMILY_MAP,
  CATEGORY_DEFS,
  DEFAULT_CATEGORIES,
  ALL_CATEGORIES,
  parseCategories,
  COMPOUND_COLOR_PROPS,
  migrateCompoundStringValue,
  migrateExactStringValue,
  processLine,
  MATCH_RE_CSS_RAW_COLOR,
  MATCH_RE_JSX_CLASSNAME,
  MATCH_RE_TW_FONTSIZE_BRACKET,
  migrateTailwindFontSizeBracket,
  FONT_SIZE_ROUNDED_KEYS,
  migrateValue,
  MATCH_RE_TW_RADIUS_BRACKET,
  migrateTailwindRadiusBracket,
  RADIUS_PROPS,
}
