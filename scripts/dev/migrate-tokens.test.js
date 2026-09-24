// GEN-2609-100 - fixture-based self-tests for migrate-tokens.js's
// shorthand colour matcher (migrateCompoundStringValue()) and its
// wiring into processLine() via COMPOUND_COLOR_PROPS. Same "plain
// Node + built-in assert, no framework" convention as
// check-design-tokens.test.js (checked package.json before writing
// this one too - still no Jest/Vitest configured).
//
// GEN-2609-101/102 extended this same file rather than starting a new
// one: both are small additional matchers (Tailwind className bracket
// colours, unquoted raw-<style>-block colours) that reuse
// migrateCompoundStringValue()/migrateExactStringValue() unchanged, so
// their fixtures belong next to the matcher they exercise.
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
  FONT_SIZE_MAP,
  COMPOUND_COLOR_PROPS,
  migrateCompoundStringValue,
  migrateExactStringValue,
  migrateTailwindFontSizeBracket,
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

t('GEN-2609-101: processLine converts a Tailwind arbitrary-value colour bracket inside className, leaving the rest of the class list untouched', () => {
  const line = '      <div className="border border-[rgba(245,245,240,0.08)] shadow-lg">'
  const out = processLine(line, false, DEFAULT_DEFS)
  assert.equal(out, '      <div className="border border-[var(--afa-tint-08)] shadow-lg">')
})

t('GEN-2609-101: an unrelated className value with no COLOR_MAP entry stays literal', () => {
  const line = '      <div className="shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35)]">'
  const out = processLine(line, false, DEFAULT_DEFS)
  assert.equal(out, line)
})

t('GEN-2609-101: a `--categories` run that excludes colour never touches className', () => {
  const line = '      <div className="border-[rgba(245,245,240,0.08)]">'
  const nonColourDefs = [CATEGORY_DEFS['font-size']]
  const out = processLine(line, false, nonColourDefs)
  assert.equal(out, line)
})

t('GEN-2609-102: processLine converts an unquoted whole-value colour inside a raw <style> block', () => {
  const line = '        .afa-events-type-filter { color: rgba(245,245,240,0.4); background: none; }'
  const out = processLine(line, true, DEFAULT_DEFS)
  assert.equal(out, '        .afa-events-type-filter { color: var(--afa-text-muted); background: none; }')
})

t('GEN-2609-102: processLine converts an unquoted colour embedded in a raw-CSS border shorthand', () => {
  const line = '        .afa-event-card { border: 1px solid rgba(245,245,240,0.1); transition: border-color 0.2s ease; }'
  const out = processLine(line, true, DEFAULT_DEFS)
  assert.equal(out, '        .afa-event-card { border: 1px solid var(--afa-tint-10); transition: border-color 0.2s ease; }')
})

t('GEN-2609-102: same raw-CSS text outside a raw block (inRawBlock=false) stays untouched - the gap this pass fixes is <style>-block-scoped', () => {
  const line = '        .afa-events-type-filter { color: rgba(245,245,240,0.4); }'
  const out = processLine(line, false, DEFAULT_DEFS)
  assert.equal(out, line)
})

t('GEN-2609-102: an unrelated raw-CSS property (no COLOR_MAP match, not even a colour prop) stays literal', () => {
  const line = '        .afa-events-select { padding: 8px 12px; border-radius: 3px; }'
  const out = processLine(line, true, DEFAULT_DEFS)
  // padding/border-radius already convert via the existing dimension
  // path (8px/12px have no SPACING_MAP entry, 3px has no RADIUS_MAP
  // entry either) - this line is a genuine full no-op, proving the new
  // raw-colour pass doesn't misfire on non-colour props.
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

t('GEN-2609-105: migrateTailwindFontSizeBracket converts a bare text-[Npx] bracket to the hinted length: form', () => {
  const out = migrateTailwindFontSizeBracket('text-[28px] font-bold', FONT_SIZE_MAP, ['px'])
  assert.equal(out, 'text-[length:var(--afa-text-page-title)] font-bold')
})

t('GEN-2609-105: never produces the bare (unhinted) text-[var(...)] form - that resolves as colour, not font-size, on the real Tailwind v4 toolchain', () => {
  const out = migrateTailwindFontSizeBracket('text-[14px]', FONT_SIZE_MAP, ['px'])
  assert.equal(out, 'text-[length:var(--afa-text-body)]')
  assert.ok(!/text-\[var\(/.test(out), 'must never emit the unhinted form')
})

t('GEN-2609-105: a value with no FONT_SIZE_MAP entry stays literal', () => {
  const out = migrateTailwindFontSizeBracket('text-[17px]', FONT_SIZE_MAP, ['px'])
  assert.equal(out, null)
})

t('GEN-2609-105: a rem bracket stays literal when only px is in scope', () => {
  const out = migrateTailwindFontSizeBracket('text-[1.75rem]', FONT_SIZE_MAP, ['px'])
  assert.equal(out, null)
})

t('GEN-2609-105: processLine converts a Tailwind arbitrary-value font-size bracket inside className, leaving the rest of the class list untouched', () => {
  const line = '        <span className="text-[28px] font-bold text-[color:var(--afa-text-primary)] no-underline lg:hidden">'
  const out = processLine(line, false, DEFAULT_DEFS)
  assert.equal(out, '        <span className="text-[length:var(--afa-text-page-title)] font-bold text-[color:var(--afa-text-primary)] no-underline lg:hidden">')
})

t('GEN-2609-105: a `--categories` run that excludes font-size never touches className', () => {
  const line = '      <p className="text-[14px] text-[color:var(--afa-text-primary)] opacity-50 mt-2">'
  const colourOnlyDefs = [CATEGORY_DEFS.colour]
  const out = processLine(line, false, colourOnlyDefs)
  assert.equal(out, line)
})

t('GEN-2609-105: never runs inside a raw <style> block - a className attribute cannot appear there', () => {
  const line = '        .afa-events-mode-tab { text-decoration: none; }' // not a real className scenario, just proves the block is skipped when inRawBlock=true
  const out = processLine(line, true, DEFAULT_DEFS)
  assert.equal(out, line)
})

console.log(`\n${passed} passed, ${failed} failed.`)
process.exit(failed > 0 ? 1 : 0)
