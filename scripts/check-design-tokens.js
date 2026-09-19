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
// than needing its own check), and a per-line `// token-ok: <reason>`
// escape hatch for genuinely-exempt cases (documented, not silently
// widened rules) - printed in CI output whenever used, so it stays
// visible rather than becoming a silent bypass. The whole-repo ratchet
// that actually tracks the total lives in scripts/design-token-
// ratchet.js, sharing these same rule definitions so the two checks
// can never drift out of sync with each other.
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

// Matches `propName: value` where value is either a bare/unit-suffixed
// number (React inline-style shorthand, e.g. `fontSize: 14` or
// `padding: '10px'`) or a quoted string (which may itself be a
// multi-value CSS shorthand like "24px 36px 56px", or an already-
// tokenized `var(--afa-*)` call). propName may be camelCase (JS style
// object key) or kebab-case (raw CSS text inside a template literal,
// e.g. the `<style>{`...`}</style>` pattern this codebase uses in a
// couple of places). Captures the raw (unquoted) value text in group 2
// (numeric) or group 3 (quoted).
const CSS_PROP_VALUE_RE = /([a-zA-Z-]+)\s*:\s*(?:(-?\d+(?:\.\d+)?(?:px|rem|em|%)?)(?=[,;}\s]|$)|['"`]([^'"`]*)['"`])/g

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
        if (!m[1].includes('var(')) return true
      }
      return false
    },
    extract: (line) => {
      const literals = []
      const re = /font-?[Ff]amily:\s*['"]([^'"]*)['"]/g
      let m
      while ((m = re.exec(line))) {
        if (!m[1].includes('var(')) literals.push(m[1])
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
  // not debt). Deliberately `skipRelocatedCheck: true`: the "extracted
  // literal" here is always the same fixed string ("<button>"), and
  // that string already exists in BASE_REF's tree at 216+ other sites
  // today - the GEN-2609-057 relocated-literal exemption (built for
  // value-uniqueness checks like a specific hex/rgba) would treat every
  // new raw <button> as "already known" and never flag it, silently
  // defeating the rule. A raw <button> tag isn't a value that can
  // "relocate" the way a color can; every new site is new regardless of
  // how many others already exist, so this rule always flags.
  {
    name: 'raw-button',
    test: (line) => /<button\b/.test(line),
    extract: (line) => (/<button\b/.test(line) ? ['<button>'] : []),
    isExemptFile: (file) => file === 'src/components/ui/Button.tsx',
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
const TOKEN_OK_RE = /\/\/\s*token-ok:\s*(.+?)\s*$/

function tokenOkReason(line) {
  const m = TOKEN_OK_RE.exec(line)
  return m ? m[1] : null
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
const EXEMPT_FILES = new Set([
  'src/app/globals.css',
  'src/lib/statusStyle.ts',
  'src/lib/design-tokens.ts',
])

function isExemptFile(file) {
  if (EXEMPT_FILES.has(file)) return true
  // Server-rendered OG/poster canvas images - not UI, already documented
  // as its own exception in docs/afa-design-tokens-reference.md Section 8.1.
  if (file.startsWith('src/app/api/posters/')) return true
  if (/\.test\.tsx?$/.test(file)) return true
  return false
}

function isCheckedFile(file) {
  return /^src\/.*\.tsx?$/.test(file)
}

function getDiff() {
  const range = `${BASE_REF}...${HEAD_REF}`
  try {
    return execSync(
      `git diff --unified=0 --diff-filter=ACMR "${range}" -- src`,
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 }
    )
  } catch (err) {
    console.error(`design-token check: failed to diff ${range}`)
    console.error(err.message)
    process.exit(1)
  }
}

function findOffenses(diffText) {
  const offenses = []
  const tokenOkUses = []
  let currentFile = null
  let checkCurrentFile = false
  let newLineNo = 0

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
      continue
    }
    if (!checkCurrentFile) continue
    if (rawLine.startsWith('---')) continue

    if (rawLine.startsWith('+')) {
      const content = rawLine.slice(1)
      const reason = tokenOkReason(content)
      if (reason) {
        tokenOkUses.push({ file: currentFile, line: newLineNo, reason, content: content.trim() })
        newLineNo++
        continue
      }
      for (const rule of RULES) {
        if (rule.isExemptFile && rule.isExemptFile(currentFile)) continue
        if (!rule.test(content)) continue
        const literals = rule.extract ? rule.extract(content) : []
        if (shouldFlag(rule, literals, isKnownLiteralInBase)) {
          offenses.push({ file: currentFile, line: newLineNo, rule: rule.name, content: content.trim() })
        }
      }
      newLineNo++
    } else if (rawLine.startsWith('-')) {
      // removed line - doesn't occupy a line number in the new file
    }
  }

  return { offenses, tokenOkUses }
}

function main() {
  const diffText = getDiff()
  const { offenses, tokenOkUses } = findOffenses(diffText)

  if (tokenOkUses.length > 0) {
    console.log(`design-token check: ${tokenOkUses.length} line(s) allowed via // token-ok: (always shown, never a silent bypass):\n`)
    for (const u of tokenOkUses) {
      console.log(`  ${u.file}:${u.line}  reason: ${u.reason}`)
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
  }
  console.error('\nUse the --afa-* / --font-* tokens from src/app/globals.css instead of literal values.')
  console.error('Genuinely exempt (e.g. a fixed third-party brand color)? Add a trailing `// token-ok: <reason>` comment on the same line.')
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
  EXEMPT_FILES,
  isKnownLiteralInBase,
  shouldFlag,
  tokenOkReason,
  findOffenses,
  extractPropValues,
  extractLengthTokensFromValue,
  isAllowlistedLength,
}
