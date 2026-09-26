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
  migrateTailwindRadiusBracket,
  RADIUS_MAP,
  RADIUS_ROUND,
  COLOR_ROUND,
  canonColor,
  colorContext,
  resolveColor,
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
  const line = "                      tick={{ fill: 'rgba(245,245,240,0.5)' }}"
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
  // GEN-2609-113 - was rgba(0,0,0,0.35), which now rounds to --afa-shadow
  const line = '      <div className="shadow-[0_8px_32px_-4px_rgba(1,2,3,0.35)]">'
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
  const line = '        .afa-events-type-filter { color: rgba(245,245,240,0.5); background: none; }'
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
  const line = '        .afa-events-select { padding: 8px 12px; border-radius: 50%; }'
  const out = processLine(line, true, DEFAULT_DEFS)
  // padding is outside DEFAULT_CATEGORIES and a % radius is never a
  // scale value (GEN-2609-112 changed this fixture from 3px, which is
  // now --afa-radius-xs) - this line is a genuine full no-op, proving the new
  // raw-colour pass doesn't misfire on non-colour props.
  assert.equal(out, line)
})

t('processLine: an unrelated rgba value not in COLOR_MAP stays literal inside a compound prop', () => {
  const line = "                  <div style={{ background: 'rgba(12,34,56,0.03)', border: '1px solid rgba(245,245,240,0.08)' }}>"
  const out = processLine(line, false, DEFAULT_DEFS)
  // GEN-2609-113 - was cream 0.03, which now rounds to --afa-tint-04.
  // background has no mapping and must stay exactly as-is;
  // only the border's 0.08 (which does) converts.
  assert.equal(out, "                  <div style={{ background: 'rgba(12,34,56,0.03)', border: '1px solid var(--afa-tint-08)' }}>")
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
  const out = migrateTailwindFontSizeBracket('text-[26px]', FONT_SIZE_MAP, ['px'])
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

// GEN-2609-112 - radius: bare JS numbers, the unitless guard, and the
// Tailwind `rounded-[Npx]` bracket pass.
const RADIUS_DEFS = [CATEGORY_DEFS.radius]

t('GEN-2609-112: a bare JS number borderRadius is px (React appends it) and becomes a quoted var()', () => {
  const out = processLine('        borderRadius: 12,', false, RADIUS_DEFS)
  assert.equal(out, "        borderRadius: 'var(--afa-radius-lg)',")
})

t('GEN-2609-112: a bare corner longhand converts the same way', () => {
  const out = processLine('      borderTopLeftRadius: 20,', false, RADIUS_DEFS)
  assert.equal(out, "      borderTopLeftRadius: 'var(--afa-radius-2xl)',")
})

t('GEN-2609-112: bare numbers inline with other props - only the radius one changes', () => {
  const line = "<div style={{ height: 4, width: 40, borderRadius: 999, background: 'var(--afa-border-resting)' }} />"
  const out = processLine(line, false, RADIUS_DEFS)
  assert.equal(out, "<div style={{ height: 4, width: 40, borderRadius: 'var(--afa-radius-pill)', background: 'var(--afa-border-resting)' }} />")
})

t('GEN-2609-112: a radius-only run never touches a bare spacing or font-size number', () => {
  const line = "<div style={{ padding: 16, fontSize: 12, borderRadius: 8 }}>"
  const out = processLine(line, false, RADIUS_DEFS)
  assert.equal(out, "<div style={{ padding: 16, fontSize: 12, borderRadius: 'var(--afa-radius-md)' }}>")
})

t('GEN-2609-112: a QUOTED unitless radius is invalid CSS (never rendered) and stays literal', () => {
  const line = "        borderRadius: '12',"
  assert.equal(processLine(line, false, RADIUS_DEFS), line)
})

t('GEN-2609-112: an unitless radius inside a raw <style> block stays literal', () => {
  const line = '        .x { border-radius: 12; }'
  assert.equal(processLine(line, true, RADIUS_DEFS), line)
})

t('GEN-2609-112: a unitless 0 inside a quoted multi-value shorthand still converts', () => {
  const out = processLine("        borderRadius: '8px 8px 0 0',", false, RADIUS_DEFS)
  assert.equal(out, "        borderRadius: 'var(--afa-radius-md) var(--afa-radius-md) var(--afa-radius-sharp) var(--afa-radius-sharp)',")
})

t('GEN-2609-112: a px radius inside a raw <style> block converts unquoted', () => {
  const out = processLine('        .x { border-radius: 16px; }', true, RADIUS_DEFS)
  assert.equal(out, '        .x { border-radius: var(--afa-radius-xl); }')
})

t('GEN-2609-112: % and negative radii stay literal', () => {
  const line = "<span style={{ borderRadius: '50%' }} />"
  assert.equal(processLine(line, false, RADIUS_DEFS), line)
  const neg = '        borderRadius: -4,'
  assert.equal(processLine(neg, false, RADIUS_DEFS), neg)
})

t('GEN-2609-112: Tailwind rounded-[16px] inside className becomes rounded-[var(--afa-radius-xl)], rest untouched', () => {
  const line = '<div className="bg-[var(--afa-surface-raised)] rounded-[16px] p-8 sm:p-10">'
  assert.equal(processLine(line, false, RADIUS_DEFS), '<div className="bg-[var(--afa-surface-raised)] rounded-[var(--afa-radius-xl)] p-8 sm:p-10">')
})

t('GEN-2609-112: Tailwind side-prefixed rounded-t-[8px] keeps its side prefix', () => {
  assert.equal(migrateTailwindRadiusBracket('rounded-t-[8px] block', CATEGORY_DEFS.radius), 'rounded-t-[var(--afa-radius-md)] block')
})

t('GEN-2609-112: RADIUS_ROUND values convert to their decided step, exact matches still win', () => {
  assert.equal(processLine("        borderRadius: '10px',", false, RADIUS_DEFS), "        borderRadius: 'var(--afa-radius-lg)',")
  assert.equal(processLine('        borderTopRightRadius: 24,', false, RADIUS_DEFS), "        borderTopRightRadius: 'var(--afa-radius-2xl)',")
  assert.equal(processLine("        borderRadius: '99px',", false, RADIUS_DEFS), "        borderRadius: 'var(--afa-radius-pill)',")
  assert.equal(processLine("        borderRadius: '2px 2px 0 0',", false, RADIUS_DEFS), "        borderRadius: 'var(--afa-radius-xs) var(--afa-radius-xs) var(--afa-radius-sharp) var(--afa-radius-sharp)',")
})

t('GEN-2609-112: RADIUS_ROUND never overlaps RADIUS_MAP (a key is exact OR rounded, never both)', () => {
  for (const k of Object.keys(RADIUS_ROUND)) assert.ok(!(k in RADIUS_MAP), `${k} is in both maps`)
})

t('GEN-2609-112: RADIUS_ROUND is radius-only - a spacing run never rounds', () => {
  const line = "<div style={{ padding: '5px' }}>"
  assert.equal(processLine(line, false, [CATEGORY_DEFS.spacing]), line)
})

t('GEN-2609-112: an off-map Tailwind radius bracket stays literal', () => {
  assert.equal(migrateTailwindRadiusBracket('rounded-[13px]', CATEGORY_DEFS.radius), null)
})

t('GEN-2609-112: the radius className pass is skipped when radius is not a selected category', () => {
  const line = '<div className="rounded-[16px]">'
  assert.equal(processLine(line, false, [CATEGORY_DEFS.colour]), line)
})

// ---------------------------------------------------------------------
// GEN-2609-113 - COLOR_ROUND, context classification, the colour pass.
// ---------------------------------------------------------------------

t('GEN-2609-113: canonColor strips spaces, lowercases hex, normalises alpha', () => {
  assert.equal(canonColor('rgba(245, 245, 240, 0.50)'), 'rgba(245,245,240,0.5)')
  assert.equal(canonColor('rgba(245,245,240,.5)'), 'rgba(245,245,240,0.5)')
  assert.equal(canonColor('#C9973A'), '#c9973a')
  assert.equal(canonColor('rgb(10, 10, 10)'), 'rgb(10,10,10)')
})

t('GEN-2609-113: COLOR_ROUND and COLOR_MAP never share a context-free key', () => {
  const exact = new Set(Object.keys(COLOR_MAP).map(canonColor))
  for (const [k, v] of Object.entries(COLOR_ROUND)) {
    if (typeof v === 'string') assert.ok(!exact.has(canonColor(k)), `${k} is in both maps`)
  }
})

t('GEN-2609-113: colorContext reads the property, Tailwind utility, attribute or assigned name', () => {
  const at = (line) => colorContext(line, line.indexOf('rgba'))
  assert.equal(at("color: 'rgba(245,245,240,0.4)'"), 'text')
  assert.equal(at("background: 'rgba(245,245,240,0.4)'"), 'surface')
  assert.equal(at("boxShadow: '0 8px 24px rgba(0,0,0,0.5)'"), 'shadow')
  assert.equal(at('<div className="text-[rgba(245,245,240,0.4)] bg-black">'), 'text')
  assert.equal(at('<div className="shadow-[0_8px_rgba(0,0,0,0.5)]">'), 'shadow')
  assert.equal(at('<Spinner scrimBackground="rgba(20,20,20,0.7)" />'), 'surface')
  assert.equal(at("el.style.background = 'rgba(247,243,238,0.05)'"), 'surface')
  assert.equal(at("tick={{ fill: 'rgba(245,245,240,0.4)' }}"), 'text')
  assert.equal(at("const MIST = 'rgba(245,245,240,0.12)'"), null)
})

t('GEN-2609-113: a ternary branch name is not mistaken for the property', () => {
  const line = "background: on ? strengthColor : 'rgba(245,245,240,0.4)',"
  assert.equal(colorContext(line, line.indexOf('rgba')), 'surface')
})

t('GEN-2609-113: cream 0.35 rounds to text-muted as text, tint-30 otherwise', () => {
  assert.equal(resolveColor('rgba(245,245,240,0.35)', 'text').token, '--afa-text-muted')
  assert.equal(resolveColor('rgba(245,245,240,0.35)', 'surface').token, '--afa-tint-30')
  assert.deepEqual(resolveColor('rgba(245,245,240,0.35)', null).ambiguous.sort(), ['--afa-text-muted', '--afa-tint-30'])
})

t('GEN-2609-113: an exact text-ladder value used as a surface still goes to the surface ladder', () => {
  assert.equal(resolveColor('rgba(245,245,240,0.5)', 'text').token, '--afa-text-muted')
  assert.equal(resolveColor('rgba(245,245,240,0.5)', 'surface').token, '--afa-tint-30')
})

t('GEN-2609-113: context-free rounds and warm-cream folding', () => {
  assert.equal(resolveColor('rgba(245,245,240,0.03)', null).token, '--afa-tint-04')
  assert.equal(resolveColor('rgba(247,243,238,0.12)', null).token, '--afa-tint-12')
  assert.equal(resolveColor('rgba(201,151,58,0.8)', 'text').token, '--afa-amber')
  assert.equal(resolveColor('#a89880', 'text').token, '--afa-text-secondary')
  assert.equal(resolveColor('rgba(10,10,10,0)', 'surface'), null)
})

t('GEN-2609-113: black 0.5 is a shadow in a shadow, a scrim as an overlay', () => {
  assert.equal(resolveColor('rgba(0,0,0,0.5)', 'shadow').token, '--afa-shadow')
  assert.equal(resolveColor('rgba(0,0,0,0.5)', 'surface').token, '--afa-scrim')
})

t('GEN-2609-113: processLine converts both branches of a ternary', () => {
  const line = "        color: tab === t ? 'var(--afa-amber)' : 'rgba(245,245,240,0.4)',"
  assert.equal(processLine(line, false, DEFAULT_DEFS), "        color: tab === t ? 'var(--afa-amber)' : 'var(--afa-text-muted)',")
})

t('GEN-2609-113: Tailwind text-[colour] gets the color: hint, other utilities a bare var()', () => {
  const line = '      <p className="text-[rgba(245,245,240,0.6)] border-[rgba(245,245,240,0.12)]">'
  assert.equal(processLine(line, false, DEFAULT_DEFS), '      <p className="text-[color:var(--afa-text-secondary)] border-[var(--afa-tint-12)]">')
})

t('GEN-2609-113: an unknown context leaves a context-dependent value literal and reports it', () => {
  const line = "const MIST = 'rgba(245,245,240,0.45)'"
  const unresolved = []
  assert.equal(processLine(line, false, DEFAULT_DEFS, unresolved), line)
  assert.equal(unresolved.length, 1)
  assert.match(unresolved[0].why, /context unknown/)
})

t('GEN-2609-113: a dynamic template alpha stays literal', () => {
  const line = '    : { fill: `rgba(245,245,240,${opacity})` }'
  assert.equal(processLine(line, false, DEFAULT_DEFS), line)
})

t('GEN-2609-113: outside a raw block, a colour must be inside quotes to convert', () => {
  const line = '  x = rgba(245,245,240,0.08)'
  assert.equal(processLine(line, false, DEFAULT_DEFS), line)
})

t('GEN-2609-113: a hex inside quotes converts; an HTML entity never does', () => {
  assert.equal(processLine("  background: '#1F1F1F',", false, DEFAULT_DEFS), "  background: 'var(--afa-surface-raised)',")
  const ent = "  label: 'A &#123; B',"
  assert.equal(processLine(ent, false, DEFAULT_DEFS), ent)
})

t('GEN-2609-113: an SVG presentation attribute is left for a hand move to style', () => {
  const unresolved = []
  const a = '<stop offset="0%" stopColor="#c9973a" stopOpacity={0.35} />'
  assert.equal(processLine(a, false, DEFAULT_DEFS, unresolved), a)
  const b = "<Cell fill={i === 0 ? '#c9973a' : 'rgba(201,151,58,0.45)'} />"
  assert.equal(processLine(b, false, DEFAULT_DEFS, unresolved), b)
  assert.equal(unresolved.length, 3)
  assert.ok(unresolved.every((u) => /SVG/.test(u.why)))
})

t('GEN-2609-113: a literal var() fallback is dropped, not tokenised into var(--x, var(--x))', () => {
  const line = "        background: mine ? 'var(--afa-sage, #4a6741)' : 'rgba(245,245,240,0.06)',"
  assert.equal(processLine(line, false, DEFAULT_DEFS), "        background: mine ? 'var(--afa-sage)' : 'var(--afa-tint-06)',")
  const unmapped = "  color: 'var(--afa-error, #b3261e)',"
  assert.equal(processLine(unmapped, false, DEFAULT_DEFS), "  color: 'var(--afa-error)',")
})

console.log(`\n${passed} passed, ${failed} failed.`)
process.exit(failed > 0 ? 1 : 0)
