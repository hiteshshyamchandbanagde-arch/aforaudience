// GEN-2609-100 - fixture-based self-tests for migrate-tokens.js's
// shorthand colour matcher (migrateCompoundStringValue()) and its
// wiring into processLine() via COMPOUND_COLOR_PROPS. Same "plain
// Node + built-in assert, no framework" convention as
// check-design-tokens.test.js (checked package.json before writing
// this one too - still no Jest/Vitest configured).
//
// Run directly:
//   node scripts/dev/migrate-tokens.test.js
//
// Wired into .github/workflows/design-tokens.yml alongside the
// check-design-tokens.test.js step, so a future change to the matcher
// that breaks one of these fixtures fails CI, not just a future
// manual dogfooding pass - same reasoning as that file's own header.
const assert = require('node:assert/strict')
const {
  COLOR_MAP,
  COMPOUND_COLOR_PROPS,
  migrateCompoundStringValue,
  migrateExactStringValue,
  processLine,
  CATEGORY_DEFS,
  DEFAULT_CATEGORIES,
} = require('./migrate-tokens')

let passed = 0
let failed = 0

function t(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ok  - ${name}`)
  } catch (err) {
    failed++
    console.error(`  FAIL - ${name}`)
    console.error(`         ${err.message}`)
  }
}

const DEFAULT_DEFS = DEFAULT_CATEGORIES.map((c) => CATEGORY_DEFS[c])

// ---------------------------------------------------------------------
// migrateCompoundStringValue() - the extraction primitive itself.
// ---------------------------------------------------------------------

t('migrateCompoundStringValue: border shorthand extracts just the colour', () => {
  const out = migrateCompoundStringValue('1px solid rgba(245,245,240,0.08)', COLOR_MAP)
  assert.equal(out, '1px solid var(--afa-tint-08)')
})

t('migrateCompoundStringValue: multi-layer boxShadow replaces each colour independently', () => {
  const out = migrateCompoundStringValue(
    '0 8px 24px rgba(245,245,240,0.15), 0 2px 4px rgba(245,245,240,0.1)',
    COLOR_MAP
  )
  assert.equal(out, '0 8px 24px var(--afa-border-resting), 0 2px 4px var(--afa-tint-10)')
})

t('migrateCompoundStringValue: no match at all returns null (full no-op)', () => {
  assert.equal(migrateCompoundStringValue('1px solid var(--afa-border-resting)', COLOR_MAP), null)
  assert.equal(migrateCompoundStringValue('2px dashed #123456', COLOR_MAP), null)
})

t('migrateCompoundStringValue: hex key never matches as a prefix of a longer, different hex literal', () => {
  // '#FFF' must NOT match inside '#FFFFFF' - a different literal string,
  // same guarantee COLOR_MAP's own header comment already documents for
  // the whole-string exact-match case.
  assert.equal(migrateCompoundStringValue('1px solid #FFFFFF', COLOR_MAP), null)
})

t('migrateCompoundStringValue: standalone hex key still matches correctly', () => {
  assert.equal(migrateCompoundStringValue('1px solid #FFF', COLOR_MAP), '1px solid var(--afa-white)')
})

t('migrateCompoundStringValue: a shorter key never falsely matches inside a longer sibling value (0.1 vs 0.15)', () => {
  // 'rgba(...,0.1)' as literal text is not a substring of
  // 'rgba(...,0.15)' - the closing paren makes them unambiguous - this
  // just proves it stays that way.
  assert.equal(migrateCompoundStringValue('1px solid rgba(245,245,240,0.15)', COLOR_MAP), '1px solid var(--afa-border-resting)')
})

t('migrateCompoundStringValue: case-insensitive, mirrors migrateExactStringValue()', () => {
  const map = { '#ABC': '--afa-test-colour' }
  assert.equal(migrateCompoundStringValue('1px solid #abc', map), '1px solid var(--afa-test-colour)')
})

// ---------------------------------------------------------------------
// processLine() - full pipeline: regex extraction + splice, on real
// line shapes pulled from the actual GEN-2609-093/100 audit findings.
// ---------------------------------------------------------------------

t('processLine: border shorthand in a JSX style object converts, rest of the object untouched', () => {
  const line = "                <div style={{ padding: 'var(--afa-space-14px)', border: '1px solid rgba(245,245,240,0.08)', marginBottom: 'var(--afa-space-14px)' }}>"
  const out = processLine(line, false, DEFAULT_DEFS)
  assert.equal(out, "                <div style={{ padding: 'var(--afa-space-14px)', border: '1px solid var(--afa-tint-08)', marginBottom: 'var(--afa-space-14px)' }}>")
})

t('processLine: borderBottom/borderTop variants also route to the compound matcher', () => {
  const line = '        <div style={{ display: "grid", borderBottom: "1px solid rgba(245,245,240,0.1)" }}>'
  const out = processLine(line, false, DEFAULT_DEFS)
  assert.equal(out, '        <div style={{ display: "grid", borderBottom: "1px solid var(--afa-tint-10)" }}>')
})

t('processLine: boxShadow converts while its numeric offsets stay literal', () => {
  const line = "                      boxShadow: '0 8px 24px rgba(245,245,240,0.15)',"
  const out = processLine(line, false, DEFAULT_DEFS)
  assert.equal(out, "                      boxShadow: '0 8px 24px var(--afa-border-resting)',")
})

t('processLine: `bg` (a non-DOM status-map key) still exact-matches, not compound', () => {
  const line = "COMPLETED:        { bg: 'rgba(245,245,240,0.08)',color: 'var(--afa-text-primary)',label: 'Completed' },"
  const out = processLine(line, false, DEFAULT_DEFS)
  assert.equal(out, "COMPLETED:        { bg: 'var(--afa-tint-08)',color: 'var(--afa-text-primary)',label: 'Completed' },")
})

t('processLine: Recharts `fill` prop exact-matches', () => {
  const line = "                      tick={{ fill: 'rgba(245,245,240,0.4)' }}"
  const out = processLine(line, false, DEFAULT_DEFS)
  assert.equal(out, "                      tick={{ fill: 'var(--afa-text-muted)' }}")
})

t('processLine: a comment line is never touched, even one that looks like a compound match', () => {
  const line = '  // border: "1px solid rgba(245,245,240,0.08)" - a comment, must NOT be touched'
  const out = processLine(line, false, DEFAULT_DEFS)
  assert.equal(out, line)
})

t('processLine: a `token-ok:` annotated line is never touched', () => {
  const line = "        border: '1px solid rgba(245,245,240,0.08)', // token-ok: intentional literal"
  const out = processLine(line, false, DEFAULT_DEFS)
  assert.equal(out, line)
})

t('processLine: Tailwind arbitrary-value bracket colour is structurally unreachable (className, not prop:value) - left untouched, not mis-converted', () => {
  const line = '      <div className="border border-[rgba(245,245,240,0.08)] shadow-lg">'
  const out = processLine(line, false, DEFAULT_DEFS)
  assert.equal(out, line)
})

t('processLine: an unrelated rgba value not in COLOR_MAP stays literal inside a compound prop', () => {
  const line = "                  <div style={{ background: 'rgba(245,245,240,0.03)', border: '1px solid rgba(245,245,240,0.08)' }}>"
  const out = processLine(line, false, DEFAULT_DEFS)
  // background: 0.03 has no COLOR_MAP entry and must stay exactly as-is;
  // only the border's 0.08 (which does) converts.
  assert.equal(out, "                  <div style={{ background: 'rgba(245,245,240,0.03)', border: '1px solid var(--afa-tint-08)' }}>")
})

t('COMPOUND_COLOR_PROPS is a subset of colour category props (mapFor() can actually find them)', () => {
  const colourDef = CATEGORY_DEFS.colour
  for (const p of COMPOUND_COLOR_PROPS) {
    assert.ok(colourDef.props.has(p), `colour category props should include "${p}"`)
  }
  assert.equal(colourDef.compoundProps, COMPOUND_COLOR_PROPS)
})

console.log(`\n${passed} passed, ${failed} failed.`)
process.exit(failed > 0 ? 1 : 0)
