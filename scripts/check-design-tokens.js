// GEN-2609-052 - blocks new hardcoded design-token literals (raw hex
// colors, rgb()/rgba() literals, hardcoded font-family strings) from
// landing on ADDED OR CHANGED lines in src/**/*.ts(x). This is the
// recurring pattern that kept surfacing screen-by-screen this session
// (Georgia,serif on /tickets, a duplicated {bg,color} STATUS_STYLE
// table on dashboard/organiser, legacy --afa-terracotta reappearing) -
// the point is to fail the PR that introduces it, not discover it
// later during another audit pass.
//
// GEN-2609-078 - the north star is "no hard coding at any page," and
// the 3 original rules only covered color + font-family. Nothing
// stopped a NEW font-size/spacing/radius/raw-<button> literal from
// landing, and nothing tracked the whole-repo total, so migration
// could never provably converge. Adds 4 more diff-only rules
// (font-size-literal, spacing-literal, radius-literal, raw-button), a
// small value-based allowlist (0, hairline 1px/0.5px, and any %
// value - the last one falls out of the unit scoping below rather
// than needing its own check), and a per-line `// token-ok(<rule>): <reason>`
// escape hatch for genuinely-exempt cases (documented, not silently
// widened rules) - printed in CI output whenever used, so it stays
// visible rather than becoming a silent bypass. The whole-repo ratchet
// that actually tracks the total lives in scripts/design-token-
// ratchet.js, sharing these same rule definitions so the two checks
// can never drift out of sync with each other.
//
// GEN-2609-080 - the `raw-button` rule as shipped in GEN-2609-078 was
// per-line: it flagged every added line containing `<button`, with no
// way to tell "this line is new debt" from "this line is a token
// retrofit of an existing raw button" (a `padding: '8px'` ->
// `padding: 'var(--afa-space-2)'` edit is 1 removed + 1 added line -
// the button count didn't change, but the old rule flagged it anyway).
// This punished the exact migration work the north star asks for and
// broke on real PRs (GEN-2609-079's seat-map and organiser-event-edit
// batches). `raw-button` is now the one rule handled outside the
// generic per-line loop in findOffenses() - it counts `<button` across
// the WHOLE diff (added vs. removed, excluding Button.tsx and lines
// with a `token-ok(raw-button)`) and flags only the surplus. See that function's
// own comments for the full mechanism.
//
// GEN-2609-109 - adds `bare-button` (`<Button variant="bare">`, the
// reset-only escape hatch GEN-2609-096 introduced) on the same
// diff-wide surplus mechanism - both are now flagged `countBased` - and
// stops raw-button counting `<button` inside code comments.
//
// GEN-2609-110 - `bare-button` now counts only UNEXPLAINED bare buttons:
// a `variant="bare"` whose line directly above carries
// `// bare-reason: <why no variant fits>` (see bareReason()) is a
// deliberate custom button, not debt. The diff is read with one line of
// context so that line above is always visible.
//
// Deliberately diff-only: pre-existing literals elsewhere in src/ (e.g.
// the hand-authored rgba() borders documented in
// docs/afa-design-tokens-reference.md Section 1) are real, known debt
// and are NOT this check's job to clean up. Only lines the current
// branch/PR actually adds or changes are scanned, via
// `git diff <base>...<head>` - same approach as GEN-2609-052's own
// verification pass. See docs/design.md and
// docs/afa-design-tokens-reference.md Section 1 for the token contract
// this enforces.
//
// Usage:
//   node scripts/check-design-tokens.js
//   BASE_REF=origin/qa HEAD_REF=HEAD node scripts/check-design-tokens.js
//
// BASE_REF defaults to origin/qa (this repo's integration branch).
// HEAD_REF defaults to HEAD. Both accept any git ref/SHA - CI sets
// BASE_REF to the PR's actual base branch (see
// .github/workflows/design-tokens.yml).
const { execSync, execFileSync } = require('child_process')

const BASE_REF = process.env.BASE_REF || 'origin/qa'
const HEAD_REF = process.env.HEAD_REF || 'HEAD'

// ---------------------------------------------------------------------
// GEN-2609-078 - shared helpers for the 4 new numeric-literal rules
// (font-size/spacing/radius all follow the same "property: value"
// shape, only the property names + allowed CSS units differ per the
// dispatch's own per-rule spec). Tightened regex, not an AST parse -
// same "small Node script" convention this file's own header comment
// and GEN-2609-057's design.md entry already established as this
// project's deliberate choice over adding an ESLint plugin.
// ---------------------------------------------------------------------

// GEN-2609-109 - the count-based button rules (raw-button, bare-button)
// must not count prose inside comments. Line-level, not a parser: a line
// that opens as a comment (`//`, `/*`, or a `*` block continuation) is
// dropped whole, closed `/* ... */` spans are removed, and a trailing
// `// ...` is cut (unless preceded by `:`, so `https://` survives).
function stripLineComments(line) {
  const trimmed = line.trimStart()
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') && !trimmed.includes('*/')) return ''
  return line
    .replace(/\/\*.*?\*\//g, '')
    .replace(/\/\*.*$/, '')
    .replace(/(^|[^:])\/\/.*$/, '$1')
}

const LOCALE_DATE_RULE = 'locale-date-call'
const LOCALE_DATE_SRC = String.raw`\.toLocale(?:Date|Time)String\(|\.toLocaleString\(\s*\)`
const LOCALE_DATE_RE = new RegExp(LOCALE_DATE_SRC)
const LOCALE_DATE_RE_G = new RegExp(LOCALE_DATE_SRC, 'g')

const RAW_BUTTON_JSX_RE = /<button(?=[\s>/]|$)/
const BARE_BUTTON_SRC = String.raw`\bvariant=(?:"bare"|'bare'|\{\s*(["'\x60])bare\1\s*\})`
const BARE_BUTTON_RE = new RegExp(BARE_BUTTON_SRC)
const BARE_BUTTON_RE_G = new RegExp(BARE_BUTTON_SRC, 'g')

// GEN-2609-110 - the escape hatch for a bare Button that is custom on
// purpose (a seat-grid cell, a carousel dot, a per-item-coloured chip).
// The comment goes on the line DIRECTLY above the `variant="bare"` line:
// inside a multi-line opening tag that is a plain `// bare-reason: ...`
// line (valid between JSX attributes); above a one-line tag in JSX
// children it is `{/* bare-reason: ... */}`. Honor system like token-ok,
// with one guard: a reason shorter than BARE_REASON_MIN_LENGTH ("custom",
// "seat") doesn't count, since the reason has to say why no variant fits.
const BARE_REASON_RE = /^\s*(?:\/\/|\{\/\*)\s*bare-reason:\s*(.*?)\s*(?:\*\/\})?\s*$/
const BARE_REASON_MIN_LENGTH = 20

function bareReason(line) {
  if (!line) return null
  const m = BARE_REASON_RE.exec(line)
  return m && m[1].length >= BARE_REASON_MIN_LENGTH ? m[1] : null
}

// Matches `propName: value` where value is either a bare/unit-suffixed
// number (React inline-style shorthand, e.g. `fontSize: 14` or
// `padding: '10px'`) or a quoted string (which may itself be a
// multi-value CSS shorthand like "24px 36px 56px", or an already-
// tokenized `var(--afa-*)` call). propName may be camelCase (JS style
// object key) or kebab-case (raw CSS text inside a template literal,
// e.g. the `<style>{`...`}</style>` pattern this codebase uses in a
// couple of places). Captures the raw (unquoted) value text in group 2
// (numeric) or group 3 (quoted).
//
// GEN-2609-089 (checker fix) - group 2's bare/unquoted branch used to
// stop at the FIRST numeric token, because its lookahead treated a bare
// `\s` as a valid terminator on its own (needed for JS object contexts
// like `fontSize: 14 }` / `fontSize: 14, padding: ...`, where the value
// is always a single token). That made it silently undercount an
// unquoted multi-value CSS shorthand - the raw `<style>{`...`}</style>`
// blocks this codebase uses can write `padding: 8px 12px;` with no
// quotes, and everything after the first space was invisible to this
// regex (found via SiteNav.tsx's raw <style> block; scripts/dev/migrate-
// tokens.js's MATCH_RE_CSS already special-cased this, see its own
// comment - this was the matching fix on the checker side, kept as one
// shared regex rather than migrate-tokens.js's two-regex/block-tracking
// split, since appending an optional repeated-numeric-token group here
// is sufficient: it only ever consumes MORE same-shaped bare numeric
// tokens, so a genuine single JS value (immediately followed by `,`/`}`
// or end-of-line, per the original lookahead) still matches exactly as
// before - it never fires when there isn't another numeric token
// immediately available.
const CSS_PROP_VALUE_RE = /([a-zA-Z-]+)\s*:\s*(?:(-?\d+(?:\.\d+)?(?:px|rem|em|%)?(?:\s+-?\d+(?:\.\d+)?(?:px|rem|em|%)?)*)(?=[,;}\s]|$)|['"`]([^'"`]*)['"`])/g

function extractPropValues(line, propNameSet) {
  const found = []
  CSS_PROP_VALUE_RE.lastIndex = 0
  let m
  while ((m = CSS_PROP_VALUE_RE.exec(line))) {
    const norm = m[1].replace(/-/g, '').toLowerCase()
    if (!propNameSet.has(norm)) continue
    found.push(m[3] !== undefined ? m[3] : m[2])
  }
  return found
}

// A raw value can be a single token ("14px") or CSS shorthand
// ("24px 36px 56px", "10px 20px") - split on whitespace and keep only
// the parts that are themselves a pure length literal in one of
// `allowedUnits` (bare numbers are treated as px, matching both React
// inline-style and plain CSS's own unitless-means-px convention for
// these properties). A part starting with `var(` is an already-
// tokenized reference, never a literal - skipped outright, so a mixed
// shorthand like "var(--afa-space-2) 10px" only flags the genuinely
// hardcoded "10px" half.
function extractLengthTokensFromValue(raw, allowedUnits) {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => {
      if (/^var\(/.test(part)) return false
      const m = /^(-?\d+(?:\.\d+)?)(px|rem|em|%)?$/.exec(part)
      if (!m) return false
      const unit = m[2] || 'px'
      return allowedUnits.includes(unit)
    })
}

// Allowlist, per the dispatch: 0 (any unit), and hairline 1px/0.5px.
// Percent values (50%, 100%) never reach this function at all - none
// of the 3 numeric rules below include "%" in their allowed-units list
// (percentage isn't part of the px/rem token scale these rules exist
// to enforce), so they're excluded by the unit scoping itself rather
// than needing a separate check here. Kept as a defensive no-op branch
// anyway so the intent reads directly off this function rather than
// being implicit in three different callers' regexes.
function isAllowlistedLength(token) {
  const m = /^(-?\d+(?:\.\d+)?)(px|rem|em|%)?$/.exec(token)
  if (!m) return false
  const value = Math.abs(parseFloat(m[1]))
  const unit = m[2] || 'px'
  if (unit === '%') return true
  if (value === 0) return true
  if (unit === 'px' && (value === 1 || value === 0.5)) return true
  return false
}

// GEN-2609-094 - `font-family: inherit` isn't hardcoding: every real
// site found by the GEN-2609-093 audit is a form control (textarea/
// input) deliberately deferring to the ambient, token-controlled font
// of its container, not a hand-picked replacement family the way
// `font-family: Georgia` or `'SF Mono'` would be. Same allowlist
// pattern as isAllowlistedLength() above (0/1px/0.5px/% are "free"
// because they're not real token-scale decisions either) - a
// definition change to what counts as debt, not a migration.
// Case-insensitive: `inherit` is a real CSS keyword, not a specific
// casing this codebase happens to use.
function isAllowlistedFontFamily(value) {
  return value.trim().toLowerCase() === 'inherit'
}

function makeLiteralRule(name, propNameSet, allowedUnits, twRegexSource, opts = {}) {
  const twRe = twRegexSource ? new RegExp(twRegexSource, 'g') : null
  function extract(line) {
    const literals = []
    for (const raw of extractPropValues(line, propNameSet)) {
      for (const token of extractLengthTokensFromValue(raw, allowedUnits)) {
        if (!isAllowlistedLength(token)) literals.push(token)
      }
    }
    if (twRe) {
      twRe.lastIndex = 0
      let m
      while ((m = twRe.exec(line))) {
        const token = `${m[1]}${m[2]}`
        if (!isAllowlistedLength(token)) literals.push(m[0])
      }
    }
    return literals
  }
  return {
    name,
    extract,
    test: (line) => extract(line).length > 0,
    isExemptFile: opts.isExemptFile,
    skipRelocatedCheck: opts.skipRelocatedCheck,
  }
}

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

const RULES = [
  {
    // Scoped to hex tokens INSIDE a quoted string, not "#" anywhere on the
    // line - a bare /#[0-9a-fA-F]{3,8}\b/ also matches this repo's own PR-
    // reference comment convention (e.g. "// ... (#261)", "PR #212"), which
    // is all-digit and therefore hex-shaped. That convention is used in 20+
    // files today and would false-positive on essentially every future
    // commit's header comment. Real hex literals in this codebase are
    // always written as quoted string values (fill="#4285F4", background:
    // "#241a10"), never bare in a comment, so requiring the match to sit
    // inside quotes removes the false positive without missing real hits.
    name: 'hex-color-literal',
    //
    // The opening and closing delimiter use a backreference (\1), not two
    // independent ['"`] classes - found via GEN-2609-053's own dogfooding:
    // a comment combining a backtick-quoted code term with a later
    // apostrophe (a plain contraction like "repo's") let the un-anchored
    // version treat the backtick as an opener and the apostrophe as its
    // closer, false-flagging an unrelated hex value sitting in between.
    test: (line) => /(['"`])[^'"`]*#[0-9a-fA-F]{3,8}\b[^'"`]*\1/.test(line),
    // GEN-2609-057 - literals this rule would flag, extracted so the
    // relocated-vs-new check below can look each one up individually
    // (a line can carry more than one quoted span).
    extract: (line) => {
      const literals = []
      const outer = /(['"`])([^'"`]*)\1/g
      let om
      while ((om = outer.exec(line))) {
        const hexRe = /#[0-9a-fA-F]{3,8}\b/g
        let hm
        while ((hm = hexRe.exec(om[2]))) literals.push(hm[0])
      }
      return literals
    },
  },
  {
    name: 'rgb-rgba-literal',
    test: (line) => /rgba?\([^)]+\)/.test(line),
    extract: (line) => line.match(/rgba?\([^)]+\)/g) || [],
  },
  {
    // Scoped to just the quoted font-family VALUE, not "rest of the line" -
    // a naive /font-?[Ff]amily:\s*['"](?!.*var\()/ lookahead scans to end
    // of line and is defeated whenever another var()-using style prop
    // (e.g. `color: 'var(--afa-text-primary)'`) sits later on the same
    // inline-style line - which is exactly how the real pre-fix Georgia
    // hits on /tickets were written. Found via this check's own
    // GEN-2609-052 verification pass against that historical case.
    name: 'hardcoded-font-family',
    test: (line) => {
      const re = /font-?[Ff]amily:\s*['"]([^'"]*)['"]/g
      let m
      while ((m = re.exec(line))) {
        if (!m[1].includes('var(') && !isAllowlistedFontFamily(m[1])) return true
      }
      return false
    },
    extract: (line) => {
      const literals = []
      const re = /font-?[Ff]amily:\s*['"]([^'"]*)['"]/g
      let m
      while ((m = re.exec(line))) {
        if (!m[1].includes('var(') && !isAllowlistedFontFamily(m[1])) literals.push(m[1])
      }
      return literals
    },
  },
  // GEN-2609-078 - font-size: numeric/px/rem `fontSize`, plus Tailwind
  // arbitrary-value `text-[Npx]`/`text-[Nrem]`. rem included at the
  // Tailwind layer too (the dispatch's own example only showed `Npx`,
  // but the property-level spec explicitly lists px+rem - extended for
  // consistency between the two forms of the same rule rather than
  // leaving a gap; flagged here, not silently assumed).
  makeLiteralRule(
    'font-size-literal',
    FONT_SIZE_PROPS,
    ['px', 'rem'],
    'text-\\[(-?\\d+(?:\\.\\d+)?)(px|rem)\\]'
  ),
  // GEN-2609-078 - spacing: non-zero PX `padding`/`margin`/`gap` (+
  // longhands), Tailwind `p|px|py|.../m|mx|my|.../gap|gap-x|gap-y-[Npx]`.
  // Deliberately px-only, per the dispatch's own literal wording ("non-
  // zero px") - rem-based spacing literals are real but out of this
  // rule's stated scope, not silently folded in.
  makeLiteralRule(
    'spacing-literal',
    SPACING_PROPS,
    ['px'],
    '\\b(?:gap-x|gap-y|gap|px|py|pt|pr|pb|pl|p|mx|my|mt|mr|mb|ml|m)-\\[(-?\\d+(?:\\.\\d+)?)(px)\\]'
  ),
  // GEN-2609-078 - radius: numeric `borderRadius` (+ 4 corner
  // longhands), Tailwind `rounded[-side]-[Npx]`. Also px-only, per the
  // dispatch's literal wording ("numeric `borderRadius`,
  // `rounded-[Npx]`") - same scoping rationale as spacing above.
  makeLiteralRule(
    'radius-literal',
    RADIUS_PROPS,
    ['px'],
    'rounded(?:-[tbrl]{1,2})?-\\[(-?\\d+(?:\\.\\d+)?)(px)\\]'
  ),
  // GEN-2609-078 - raw <button>, allowed only inside Button.tsx itself
  // (the one file where the literal tag is the actual implementation,
  // not debt).
  //
  // GEN-2609-080 - `skipRelocatedCheck: true` is kept (raw <button> was
  // never a "relocatable value" the GEN-2609-057 exemption's exact-
  // string matching could meaningfully apply to - the string "<button>"
  // trivially already exists at 200+ other sites regardless of whether
  // a given line is new debt), but it no longer decides this rule's
  // real behavior. `findOffenses()` below now excludes `raw-button`
  // from the generic per-line loop entirely and instead counts `<button`
  // on added vs. removed lines across the WHOLE diff, flagging only the
  // surplus - see that block's own comment for why. `skipRelocatedCheck`
  // stays `true` here purely as a defensive/documentary marker (if this
  // rule were ever fed through the generic per-line path again by
  // mistake, it should still flag-always rather than silently adopt the
  // relocated-literal exemption, which was never correct for it).
  //
  // Why the count had to change from "every added line" to "diff-wide
  // surplus": a token-retrofit edit to an EXISTING raw button (e.g.
  // `padding: '8px'` -> `padding: 'var(--afa-space-2)'` on a line that
  // also contains `<button`) is one removed line + one added line in
  // the diff - the raw-button COUNT didn't change, but the old rule
  // flagged it anyway, since it only ever asked "does this added line
  // contain `<button`," never "did the number of raw buttons actually
  // go up." Reproduced live against 2 real PRs before this fix: PR #660
  // (seat-map) failed at 6 sites, PR #662 (organiser event edit) failed
  // at 1 - all 7 were retrofit-only edits to already-existing buttons,
  // not new debt. This was a design flaw in GEN-2609-078 itself, not in
  // those PRs, and it directly punished the exact migration work the
  // north star asks for.
  //
  // GEN-2609-109 - matches JSX only: the old bare `/<button\b/` also hit
  // prose inside code comments (EventSaveButton.tsx's `// ... native
  // <button> keyboard activation`, VenuePortalUI.tsx's `/* ... (Next
  // <Link>, not <button>) */` section header), inflating the count by 2.
  // Comments are stripped first (see stripLineComments), and the tag
  // must be followed by whitespace, `>`, `/` or end-of-line - the only
  // ways a real JSX opening tag can continue.
  {
    name: 'raw-button',
    test: (line) => RAW_BUTTON_JSX_RE.test(stripLineComments(line)),
    extract: (line) => (RAW_BUTTON_JSX_RE.test(stripLineComments(line)) ? ['<button>'] : []),
    isExemptFile: (file) => file === 'src/components/ui/Button.tsx',
    skipRelocatedCheck: true,
    countBased: true,
  },
  // GEN-2609-109 - `<Button variant="bare">` is GEN-2609-096's reset-only
  // escape hatch: routed through the shared component, but still styled
  // entirely by the caller, so an admin edit in /dashboard/admin/design-
  // system never reaches it. Phase 1 moved 162 raw buttons onto it (176
  // uses); without a ratchet, `bare` would simply become the new raw
  // <button>. Same diff-wide surplus mechanism as raw-button above (a
  // restyle of an existing bare site is -1/+1 and nets to 0, and
  // converting a bare site to a real variant is a pure -1), so only a
  // genuine net increase fails. Counted per occurrence, not per line.
  // GEN-2609-110 - `prevLine` is the line directly above; a valid
  // `bare-reason` there makes every bare Button on this line explained,
  // so it isn't counted (see bareReason()).
  {
    name: 'bare-button',
    test: (line, prevLine) => BARE_BUTTON_RE.test(stripLineComments(line)) && !bareReason(prevLine),
    extract: (line, prevLine) => (bareReason(prevLine) ? [] : stripLineComments(line).match(BARE_BUTTON_RE_G) || []),
    skipRelocatedCheck: true,
    countBased: true,
  },
  // BUG-2609-071 - not a design-token literal, but the same kind of
  // "one source, no local copies" rule, so it rides on this checker and
  // its ratchet: dates and times are formatted only by
  // src/lib/format-date.ts (UI locale, unambiguous styles, India time).
  // Flags toLocaleDateString( and toLocaleTimeString( anywhere else, and
  // toLocaleString() with no arguments (the browser-locale form).
  // toLocaleString('en-IN') on a number, for rupee amounts, is fine and
  // not matched.
  {
    name: LOCALE_DATE_RULE,
    test: (line) => LOCALE_DATE_RE.test(stripLineComments(line)),
    extract: (line) => stripLineComments(line).match(LOCALE_DATE_RE_G) || [],
    isExemptFile: (file) => file === 'src/lib/format-date.ts',
    skipRelocatedCheck: true,
  },
]

// GEN-2609-078 - per-line escape hatch for genuinely-exempt literals
// (the dispatch's own example: a fixed third-party brand SVG fill,
// e.g. Google's 4-color logo, that must never be tokenized). Not
// implemented as a hardcoded brand-hex allowlist - guessing which
// specific hex values count as "brand" is exactly the kind of
// assumption the dispatch says to flag instead of make (see this
// ticket's handoff entry, "refused to guess" section). A trailing
// `// token-ok: <reason>` comment on the SAME line as the literal
// suppresses every rule on that line - and is always printed in CI
// output (both pass and fail runs), so a bypass can never go quietly
// unnoticed the way a silent allowlist entry could.
//
// GEN-2609-085 - the `//` form only works where the flagged literal
// already sits inside a JS expression. It can't be used on a raw JSX
// markup line like `<path fill="#4285F4" d="..."/>` (an SVG icon's own
// attributes, not wrapped in `{}`): appending `// text` there isn't a
// comment at all in JSX - it becomes a literal sibling text node
// (`// text` would actually render inside the <svg>), which is exactly
// the real-world case this ticket exists to fix (the Google 4-color
// logo markup in RegisterForm.tsx/login/page.tsx, never annotated
// because the `//` form couldn't be used on it). Added a second,
// equally-visible form for exactly that context: a same-line JSX
// comment, `{/* token-ok: <reason> */}`, placed immediately after the
// element with no separating whitespace token (so it doesn't itself
// inject a stray whitespace text node). Both forms are simple
// substring/regex matches, same "honor system, not a parser" tradeoff
// as the original - see this file's own header and docs/design.md.
//
// GEN-2609-117 - scoped to the rule(s) it names. The unscoped form
// exempted every rule on its line, so a one-line style with an exempt
// fontSize also hid its padding (#713: spacing 1866 -> 1863). Now
// `// token-ok(<rule>[,<rule>]): <reason>` (or the JSX form) exempts
// only those RULES names; every other rule still runs on the line. The
// unscoped form, an unknown rule name, or any other `token-ok` comment
// that doesn't parse is an error, not a silent no-op. This is the one
// parser; design-token-ratchet.js uses it too, so both agree.
const TOKEN_OK_RE = /\/\/\s*token-ok\(([^)]*)\):\s*(.+?)\s*$/
const TOKEN_OK_JSX_RE = /\{\/\*\s*token-ok\(([^)]*)\):\s*(.+?)\s*\*\/\}\s*$/
const TOKEN_OK_MARKER_RE = /(?:\/\/|\/\*)\s*token-ok\b/
const RULE_NAMES = RULES.map((r) => r.name)
const TOKEN_OK_SYNTAX =
  '`// token-ok(<rule>[,<rule>]): <reason>` or `{/* token-ok(<rule>): <reason> */}`'

// null (no token-ok comment), { rules, reason }, or { error }.
function parseTokenOk(line) {
  if (!line || !TOKEN_OK_MARKER_RE.test(line)) return null
  const m = TOKEN_OK_RE.exec(line) || TOKEN_OK_JSX_RE.exec(line)
  if (!m) {
    if (/token-ok\s*:/.test(line)) {
      return { error: `unscoped \`token-ok:\` is no longer accepted; name the rule(s) it exempts: ${TOKEN_OK_SYNTAX}` }
    }
    return { error: `malformed token-ok comment; expected ${TOKEN_OK_SYNTAX} at the end of the line` }
  }
  const rules = [...new Set(m[1].split(',').map((s) => s.trim()).filter(Boolean))]
  if (rules.length === 0) return { error: `token-ok names no rule; expected ${TOKEN_OK_SYNTAX}` }
  const unknown = rules.filter((r) => !RULE_NAMES.includes(r))
  if (unknown.length > 0) {
    return { error: `unknown rule ${unknown.map((r) => `"${r}"`).join(', ')} in token-ok; valid: ${RULE_NAMES.join(', ')}` }
  }
  return { rules, reason: m[2] }
}

// The rule names a valid token-ok on this line exempts ([] otherwise).
function tokenOkRules(line) {
  const ok = parseTokenOk(line)
  return ok && ok.rules ? ok.rules : []
}

// GEN-2609-057 - a pure refactor/extraction can move an existing literal
// onto a new (added) line without changing its value at all - the diff
// alone can't tell "relocated" from "genuinely new" apart, since both
// show up as a `+` line. Concretely: GEN-2609-056 extracted a shared
// SpinnerOverlay.tsx from 3 call sites, and every rgba() value it moved
// (e.g. rgba(20,20,20,0.7)) already existed, unchanged, in origin/qa
// before that branch touched anything - confirmed via `git grep` against
// origin/qa's tree before writing this fix, not assumed from the ticket.
//
// Fix: before flagging a literal found on an added line, check whether
// that EXACT string already exists anywhere in BASE_REF's src/ tree (not
// just the touched files - a literal can move file-to-file too, the way
// SpinnerOverlay.tsx pulled values in from 2 different files). Matching
// is on the literal value itself, not the line/file, and uses `git grep`
// against the base ref's tree object directly - no working-tree checkout
// of the base ref needed, and it naturally still requires CI's existing
// `fetch-depth: 0` for the object to be locally available.
//
// Deliberately an EXACT string match, not a fuzzy one: editing an
// existing literal's value even slightly (rgba(20,20,20,0.7) ->
// rgba(21,20,20,0.7)) produces a string with no match in the base tree,
// so it's still flagged as new - only a byte-identical pre-existing
// literal is treated as relocated debt.
const knownInBaseCache = new Map()
function isKnownLiteralInBase(literal) {
  if (knownInBaseCache.has(literal)) return knownInBaseCache.get(literal)
  let known
  try {
    execFileSync('git', ['grep', '--fixed-strings', '--quiet', '-e', literal, BASE_REF, '--', 'src'], {
      stdio: 'ignore',
    })
    known = true
  } catch (err) {
    // git grep exits 1 for "no match found" - that's the normal, expected
    // "genuinely new" case, not a failure. Any other exit code (bad ref,
    // pathspec error, etc.) is a real problem and should surface as one.
    if (err.status === 1) {
      known = false
    } else {
      console.error(`design-token check: git grep against ${BASE_REF} failed unexpectedly`)
      console.error(err.message)
      process.exit(1)
    }
  }
  knownInBaseCache.set(literal, known)
  return known
}

// GEN-2609-078 - extracted so both findOffenses() (diff-only) and
// scripts/design-token-ratchet.js (whole-repo) share exactly one
// decision about when a rule's literals are "relocated debt, skip" vs.
// "flag it" - see the raw-button rule's own comment above for why
// skipRelocatedCheck exists.
// Callers only invoke this after rule.test(content) already returned true,
// so "flag unconditionally" for a skipRelocatedCheck rule is safe - there's
// always a real match to report.
function shouldFlag(rule, literals, isKnownInBaseFn) {
  if (rule.skipRelocatedCheck) return true
  if (literals.length === 0) return true // extract() found nothing but test() fired - fail open
  return !literals.every(isKnownInBaseFn)
}

// Exact-path exemptions - the actual token source and the tone
// source-of-truth extracted in GEN-2609-051 legitimately hold literal
// values; everything else should draw from them instead of re-typing.
//
// GEN-2609-075 - src/lib/design-tokens.ts's DEFAULT_TOKEN_VALUES is a
// second, DB-backed token source-of-truth (mirrors globals.css's
// values 1:1, deliberately - see that file's own header comment for
// why "reset to defaults" needs its own copy rather than re-reading
// globals.css at runtime). Same exemption rationale as globals.css
// itself: this is where these literals are SUPPOSED to live, not a new
// gap in the checker.
// GEN-2609-119 - the surfaces where `var(--afa-*)` structurally cannot
// resolve (email HTML, the ticket PDF, the manifest, the poster images)
// were exempt from every rule here (GEN-2609-094). They now read their
// colours from the design tokens through a server-side resolver
// (src/lib/design-tokens.server.ts), so they are checked like any other
// file for the colour rules: a new hex or rgb() literal in one of them
// is debt again, unless it carries a token-ok (the logo, the QR).
//
// Two narrower lists replace the old whole-file exemption:
//   - isSizingExemptFile: email.ts and the poster routes still carry
//     literal px sizes, spacing, radii and font families, and always
//     will - an email client and Satori's 1080px canvas have no CSS
//     custom properties to read. Only the non-colour rules skip them.
//     ticket-pdf.ts and manifest.ts have no such literals and get no
//     exemption at all.
//   - isMigrationExcludedFile: migrate-tokens.js must still never
//     rewrite any of them into var() references, which would render as
//     nothing (the concrete risk GEN-2609-094 recorded for email.ts).
const EXEMPT_FILES = new Set([
  'src/app/globals.css',
  'src/lib/statusStyle.ts',
  'src/lib/design-tokens.ts',
])

function isExemptFile(file) {
  if (EXEMPT_FILES.has(file)) return true
  if (/\.test\.tsx?$/.test(file)) return true
  return false
}

const COLOUR_RULE_NAMES = new Set(['hex-color-literal', 'rgb-rgba-literal'])

function isSizingExemptFile(file) {
  return file === 'src/lib/email.ts' || file.startsWith('src/app/api/posters/')
}

const NO_VAR_FILES = new Set([
  'src/lib/email.ts',
  'src/lib/ticket-pdf.ts',
  'src/app/manifest.ts',
  'src/lib/poster-colors.ts',
])

function isMigrationExcludedFile(file) {
  return isExemptFile(file) || NO_VAR_FILES.has(file) || file.startsWith('src/app/api/posters/')
}

// Every non-colour rule skips the sizing-exempt files, on top of any
// file exemption of its own (raw-button's Button.tsx). The date rule is
// not about sizing, so it still runs on email.ts and the posters.
for (const rule of RULES) {
  if (COLOUR_RULE_NAMES.has(rule.name) || rule.name === LOCALE_DATE_RULE) continue
  const own = rule.isExemptFile
  rule.isExemptFile = (file) => isSizingExemptFile(file) || (!!own && own(file))
}

function isCheckedFile(file) {
  return /^src\/.*\.tsx?$/.test(file)
}

function getDiff() {
  const range = `${BASE_REF}...${HEAD_REF}`
  try {
    return execSync(
      // GEN-2609-110 - one context line (was 0), so the line above any
      // changed line is always in the diff for bare-reason.
      `git diff --unified=1 --diff-filter=ACMR "${range}" -- src`,
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 }
    )
  } catch (err) {
    console.error(`design-token check: failed to diff ${range}`)
    console.error(err.message)
    process.exit(1)
  }
}

// GEN-2609-080 - the one rule in RULES handled outside the generic
// per-line loop in findOffenses() below (see that rule's own comment
// for why: a retrofit edit to an existing raw button is 1 removed + 1
// added line, and the old per-line "does this added line match" check
// couldn't tell that apart from a genuinely new one).
//
// GEN-2609-109 - generalized from raw-button alone to every rule marked
// `countBased` (raw-button + bare-button), each with its own surplus.
const COUNT_RULES = RULES.filter((r) => r.countBased)
const PER_LINE_RULES = RULES.filter((r) => !r.countBased)

function findOffenses(diffText) {
  const offenses = []
  const tokenOkUses = []
  const bareReasonUses = []
  let currentFile = null
  let checkCurrentFile = false
  let newLineNo = 0
  // GEN-2609-110 - the line directly above the current one, in the new
  // file (for `+` lines) and in the old file (for `-` lines). Context
  // lines (` `) are in both. Unknown ('') at the start of a hunk.
  let prevNew = ''
  let prevOld = ''

  // GEN-2609-080 - accumulated across the WHOLE diff (every file the PR
  // touches), not per-file: a raw button genuinely moved from one file
  // to another (an extract-component refactor) is -1 in the source file
  // and +1 in the destination - diff-wide, that nets to 0 and correctly
  // passes; counted per-file instead, the destination file's own +1
  // would wrongly flag as new debt. The whole-repo ratchet
  // (design-token-ratchet.js) is the actual backstop on the total count
  // regardless of how literals shuffle between files.
  const countAdded = new Map(COUNT_RULES.map((r) => [r.name, []])) // rule -> [{ file, line, content }], in diff order
  const countRemoved = new Map(COUNT_RULES.map((r) => [r.name, 0]))
  const countFileExempt = (rule) => !!currentFile && !!rule.isExemptFile && rule.isExemptFile(currentFile)

  for (const rawLine of diffText.split('\n')) {
    if (rawLine.startsWith('+++ ')) {
      const p = rawLine.slice(4).trim()
      currentFile = p === '/dev/null' ? null : p.replace(/^b\//, '')
      checkCurrentFile = !!currentFile && isCheckedFile(currentFile) && !isExemptFile(currentFile)
      continue
    }
    if (rawLine.startsWith('@@')) {
      const m = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(rawLine)
      newLineNo = m ? parseInt(m[1], 10) : 0
      prevNew = ''
      prevOld = ''
      continue
    }
    if (!checkCurrentFile) continue
    if (rawLine.startsWith('---')) continue

    if (rawLine.startsWith(' ')) {
      // GEN-2609-110 - an unchanged line can still change status: a bare
      // Button under a bare-reason comment that this diff added or removed.
      // Its count moves by the difference between old and new context.
      const content = rawLine.slice(1)
      const exempt = tokenOkRules(content)
      for (const rule of COUNT_RULES) {
        if (countFileExempt(rule) || exempt.includes(rule.name)) continue
        const delta = rule.extract(content, prevNew).length - rule.extract(content, prevOld).length
        for (let i = 0; i < delta; i++) countAdded.get(rule.name).push({ file: currentFile, line: newLineNo, content: content.trim() })
        if (delta < 0) countRemoved.set(rule.name, countRemoved.get(rule.name) - delta)
      }
      prevNew = content
      prevOld = content
      newLineNo++
      continue
    }

    if (rawLine.startsWith('+')) {
      const content = rawLine.slice(1)
      const prevLine = prevNew
      prevNew = content
      const bare = bareReason(content)
      if (bare) bareReasonUses.push({ file: currentFile, line: newLineNo, reason: bare })
      // GEN-2609-117 - token-ok suppresses only the rules it names (a
      // named count rule never enters the added count below); a comment
      // that doesn't parse is itself an offense and exempts nothing.
      const ok = parseTokenOk(content)
      let exempt = []
      if (ok && ok.error) {
        offenses.push({ file: currentFile, line: newLineNo, rule: 'token-ok-syntax', content: content.trim(), message: ok.error })
      } else if (ok) {
        exempt = ok.rules
        tokenOkUses.push({ file: currentFile, line: newLineNo, rules: ok.rules, reason: ok.reason, content: content.trim() })
      }
      for (const rule of PER_LINE_RULES) {
        if (rule.isExemptFile && rule.isExemptFile(currentFile)) continue
        if (exempt.includes(rule.name)) continue
        if (!rule.test(content)) continue
        const literals = rule.extract ? rule.extract(content) : []
        if (shouldFlag(rule, literals, isKnownLiteralInBase)) {
          offenses.push({ file: currentFile, line: newLineNo, rule: rule.name, content: content.trim() })
        }
      }
      for (const rule of COUNT_RULES) {
        if (countFileExempt(rule) || exempt.includes(rule.name)) continue
        // one entry per occurrence, so two bare Buttons on one line count as 2
        for (let i = 0; i < rule.extract(content, prevLine).length; i++) {
          countAdded.get(rule.name).push({ file: currentFile, line: newLineNo, content: content.trim() })
        }
      }
      newLineNo++
    } else if (rawLine.startsWith('-')) {
      // removed line - doesn't occupy a line number in the new file
      const content = rawLine.slice(1)
      const prevLine = prevOld
      prevOld = content
      // an exempted button was never counted, so removing it isn't a -1
      const exempt = tokenOkRules(content)
      for (const rule of COUNT_RULES) {
        if (countFileExempt(rule) || exempt.includes(rule.name)) continue
        countRemoved.set(rule.name, countRemoved.get(rule.name) + rule.extract(content, prevLine).length)
      }
    }
  }

  // GEN-2609-080 - flag only the surplus: if this diff removed as many
  // (or more) raw <button>s than it added, the count didn't go up and
  // nothing is flagged, no matter how many individual lines changed.
  // The specific lines reported are the LAST `surplus` added entries in
  // diff order - with count alone there's no way to know which of the
  // added lines is "the genuinely new one" vs. "a retrofit," so this
  // picks a deterministic, arbitrary-but-consistent subset rather than
  // either flagging all of them (the old, wrong behavior) or guessing.
  for (const rule of COUNT_RULES) {
    const added = countAdded.get(rule.name)
    const surplus = added.length - countRemoved.get(rule.name)
    if (surplus > 0) {
      for (const entry of added.slice(-surplus)) {
        offenses.push({ file: entry.file, line: entry.line, rule: rule.name, content: entry.content })
      }
    }
  }

  return { offenses, tokenOkUses, bareReasonUses }
}

function main() {
  const diffText = getDiff()
  const { offenses, tokenOkUses, bareReasonUses } = findOffenses(diffText)

  if (bareReasonUses.length > 0) {
    console.log(`design-token check: ${bareReasonUses.length} bare Button reason(s) added (always shown):\n`)
    for (const u of bareReasonUses) console.log(`  ${u.file}:${u.line}  bare-reason: ${u.reason}`)
    console.log('')
  }

  if (tokenOkUses.length > 0) {
    console.log(`design-token check: ${tokenOkUses.length} line(s) allowed via token-ok(<rule>) (always shown, never a silent bypass):\n`)
    for (const u of tokenOkUses) {
      console.log(`  ${u.file}:${u.line}  [${u.rules.join(', ')}]  reason: ${u.reason}`)
      console.log(`    ${u.content}`)
    }
    console.log('')
  }

  if (offenses.length === 0) {
    console.log(`design-token check: no new hardcoded design-token literals (${BASE_REF}...${HEAD_REF}).`)
    process.exit(0)
  }

  console.error(`design-token check: found ${offenses.length} new hardcoded design-token literal(s):\n`)
  for (const o of offenses) {
    console.error(`  ${o.file}:${o.line}  [${o.rule}]`)
    console.error(`    ${o.content}`)
    if (o.message) console.error(`    ${o.message}`)
  }
  console.error('\nUse the --afa-* / --font-* tokens from src/app/globals.css instead of literal values.')
  console.error('For [locale-date-call]: format dates and times with formatDate() from src/lib/format-date.ts.')
  console.error(`Genuinely exempt (e.g. a fixed third-party brand color)? End the line with ${TOKEN_OK_SYNTAX}, naming only the rule(s) the reason covers.`)
  console.error('See docs/afa-design-tokens-reference.md Section 1 and docs/design.md.')
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  RULES,
  isCheckedFile,
  isExemptFile,
  isSizingExemptFile,
  isMigrationExcludedFile,
  EXEMPT_FILES,
  isKnownLiteralInBase,
  shouldFlag,
  parseTokenOk,
  tokenOkRules,
  bareReason,
  stripLineComments,
  findOffenses,
  extractPropValues,
  extractLengthTokensFromValue,
  isAllowlistedLength,
  isAllowlistedFontFamily,
}
