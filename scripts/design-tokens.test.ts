// GEN-2609-108 - self-tests for the editor guardrails in
// src/lib/design-tokens.ts. Same plain Node + assert convention as
// ticket-code.test.ts (no test framework in this repo):
//
//   npx tsx scripts/design-tokens.test.ts
import assert from 'node:assert/strict'
import {
  DEFAULT_TOKEN_VALUES,
  KEY_RANGES,
  GROUP_RANGES,
  RADIUS_ORDER,
  CONTRAST_PAIRS,
  contrastFailures,
  composeRgba,
  contrastMinimum,
  contrastRatio,
  formatAlpha,
  isValidTokenValue,
  pairRatio,
  parseCssColor,
  planRestore,
  radiusOrderErrors,
  restoreContrastFailures,
  restoreNote,
  snapshotNote,
  SNAPSHOT_REASON_MAX,
  rangeFor,
  rgbToHex,
  resolveColorValue,
  toPdfRgb,
  COLOR_RESOLVE_MAX_DEPTH,
  UNRESOLVED_COLOR,
  tokenValueError,
  type TokenType,
} from '../src/lib/design-tokens'
import { COLOR_SECTIONS, TOKEN_META, tokenMatches } from '../src/lib/design-token-meta'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

function typeOf(key: string): TokenType {
  if (key.startsWith('--font-')) return 'font-family'
  if (key.startsWith('--afa-btn-padding-')) return 'dimension-shorthand'
  return /^(#|rgb|var\()/.test(DEFAULT_TOKEN_VALUES[key]) ? 'color' : 'dimension'
}

// --- A. ranges and shapes -------------------------------------------------

test('every default value passes its own key rules', () => {
  for (const [key, value] of Object.entries(DEFAULT_TOKEN_VALUES)) {
    assert.equal(tokenValueError(key, typeOf(key), value), null, `${key}: ${value}`)
  }
})

test('the default radius scale is ordered', () => {
  assert.deepEqual(radiusOrderErrors(DEFAULT_TOKEN_VALUES), [])
})

test('real QA bad value: --afa-radius-pill 0100000px is rejected (leading zero)', () => {
  assert.equal(tokenValueError('--afa-radius-pill', 'dimension', '0100000px'), 'Remove the leading zero.')
  assert.equal(isValidTokenValue('dimension', '0100000px', '--afa-radius-pill'), false)
  // and without a key (render path) the shape alone rejects it too
  assert.equal(isValidTokenValue('dimension', '0100000px'), false)
})

test('real QA bad value: --afa-radius-md 200px is rejected (range)', () => {
  assert.equal(tokenValueError('--afa-radius-md', 'dimension', '200px'), 'Must be between 0px and 40px.')
})

test('radius range 0-40px, edges inclusive', () => {
  assert.equal(tokenValueError('--afa-radius-lg', 'dimension', '0px'), null)
  assert.equal(tokenValueError('--afa-radius-lg', 'dimension', '0'), null)
  assert.equal(tokenValueError('--afa-radius-lg', 'dimension', '40px'), null)
  assert.notEqual(tokenValueError('--afa-radius-lg', 'dimension', '40.5px'), null)
})

test('pill must be >= 100px', () => {
  assert.notEqual(tokenValueError('--afa-radius-pill', 'dimension', '99px'), null)
  assert.notEqual(tokenValueError('--afa-radius-pill', 'dimension', '40px'), null)
  assert.equal(tokenValueError('--afa-radius-pill', 'dimension', '100px'), null)
  assert.equal(tokenValueError('--afa-radius-pill', 'dimension', '999px'), null)
})

test('radius order: md above lg names lg', () => {
  const values = { ...DEFAULT_TOKEN_VALUES, '--afa-radius-md': '14px' }
  const errs = radiusOrderErrors(values, ['--afa-radius-md'])
  assert.equal(errs.length, 1)
  assert.equal(errs[0].key, '--afa-radius-md')
  assert.match(errs[0].message, /--afa-radius-lg \(12px\)/)
})

test('radius order: lowering lg below md names md', () => {
  const values = { ...DEFAULT_TOKEN_VALUES, '--afa-radius-lg': '4px' }
  const errs = radiusOrderErrors(values, ['--afa-radius-lg'])
  assert.equal(errs.length, 1)
  assert.equal(errs[0].key, '--afa-radius-lg')
  assert.match(errs[0].message, /smaller than --afa-radius-md \(8px\)/)
})

test('radius order: equal neighbours are fine', () => {
  const values = { ...DEFAULT_TOKEN_VALUES, '--afa-radius-md': '12px' }
  assert.deepEqual(radiusOrderErrors(values, ['--afa-radius-md']), [])
})

test('radius order: an existing break not touched by this save is not reported', () => {
  const values = { ...DEFAULT_TOKEN_VALUES, '--afa-radius-xs': '7px' }
  assert.deepEqual(radiusOrderErrors(values, ['--afa-radius-2xl']), [])
  assert.equal(radiusOrderErrors(values).length, 1)
})

test('radius order covers the whole scale, pill excluded', () => {
  assert.deepEqual([...RADIUS_ORDER], ['--afa-radius-sharp', '--afa-radius-xs', '--afa-radius-sm', '--afa-radius-md', '--afa-radius-lg', '--afa-radius-xl', '--afa-radius-2xl'])
})

test('font sizes 10-72px; running-text roles 11-24px; caption 9-16px', () => {
  assert.equal(tokenValueError('--afa-text-page-title-lg', 'dimension', '72px'), null)
  assert.notEqual(tokenValueError('--afa-text-page-title-lg', 'dimension', '73px'), null)
  assert.notEqual(tokenValueError('--afa-text-page-title-lg', 'dimension', '9px'), null)
  // GEN-2609-115 - caption is a small-text role
  assert.notEqual(tokenValueError('--afa-text-caption', 'dimension', '8px'), null)
  assert.equal(tokenValueError('--afa-text-caption', 'dimension', '9px'), null)
  assert.equal(tokenValueError('--afa-text-caption', 'dimension', '10px'), null)
  assert.equal(tokenValueError('--afa-text-caption', 'dimension', '16px'), null)
  assert.equal(tokenValueError('--afa-text-caption', 'dimension', '17px'), 'Must be between 9px and 16px.')
  for (const key of ['--afa-text-micro', '--afa-text-small', '--afa-text-ui', '--afa-text-body', '--afa-text-body-lg']) {
    assert.notEqual(tokenValueError(key, 'dimension', '10px'), null, key)
    assert.equal(tokenValueError(key, 'dimension', '11px'), null, key)
    assert.equal(tokenValueError(key, 'dimension', '24px'), null, key)
    assert.notEqual(tokenValueError(key, 'dimension', '25px'), null, key)
  }
})

test('spacing 0-64px', () => {
  assert.equal(tokenValueError('--afa-space-4', 'dimension', '64px'), null)
  assert.notEqual(tokenValueError('--afa-space-4', 'dimension', '65px'), null)
})

test('button padding 0-64px per part', () => {
  assert.equal(tokenValueError('--afa-btn-padding-md', 'dimension-shorthand', '0px 64px'), null)
  assert.equal(tokenValueError('--afa-btn-padding-md', 'dimension-shorthand', '65px 10px'), 'Must be between 0px and 64px.')
  assert.equal(tokenValueError('--afa-btn-padding-md', 'dimension-shorthand', '10px 65px'), 'Must be between 0px and 64px.')
  assert.equal(tokenValueError('--afa-btn-padding-md', 'dimension-shorthand', '09px 17px'), 'Remove the leading zero.')
})

test('ranged tokens need px', () => {
  assert.equal(tokenValueError('--afa-radius-md', 'dimension', '1rem'), 'Use px for this token.')
  assert.equal(tokenValueError('--afa-text-body', 'dimension', '100%'), 'Use px for this token.')
})

test('no negative dimensions', () => {
  assert.equal(tokenValueError('--afa-space-4', 'dimension', '-4px'), 'Negative values are not allowed.')
  assert.equal(tokenValueError('--afa-btn-padding-md', 'dimension-shorthand', '4px -4px'), 'Negative values are not allowed.')
  assert.equal(isValidTokenValue('dimension', '-4px'), false)
})

test('leading zeros and bare decimals rejected, decimals allowed', () => {
  assert.notEqual(tokenValueError('--afa-space-4', 'dimension', '016px'), null)
  assert.notEqual(tokenValueError('--afa-space-4', 'dimension', '.5px'), null)
  assert.equal(tokenValueError('--afa-space-4', 'dimension', '0.5px'), null)
  assert.equal(tokenValueError('--afa-space-4', 'dimension', '10.25px'), null)
})

test('range table lookup: key beats group', () => {
  assert.deepEqual(rangeFor('--afa-radius-pill'), KEY_RANGES['--afa-radius-pill'])
  assert.deepEqual(rangeFor('--afa-radius-md'), GROUP_RANGES.radius)
  assert.deepEqual(rangeFor('--afa-text-heading'), GROUP_RANGES.size)
  assert.equal(rangeFor('--afa-amber'), null)
})

test('rgb channels 0-255', () => {
  assert.equal(isValidTokenValue('color', 'rgba(255, 255, 255, 0.5)', '--afa-text-muted'), true)
  assert.equal(isValidTokenValue('color', 'rgba(0, 0, 0, 0)', '--afa-text-muted'), true)
  assert.equal(isValidTokenValue('color', 'rgba(256, 0, 0, 0.5)', '--afa-text-muted'), false)
  assert.equal(isValidTokenValue('color', 'rgba(999, 0, 0, 0.5)', '--afa-text-muted'), false)
  assert.equal(isValidTokenValue('color', 'rgb(0, 300, 0)'), false)
  assert.equal(isValidTokenValue('color', 'rgba(010, 0, 0, 0.5)'), false)
})

test('alpha 0-1', () => {
  assert.equal(isValidTokenValue('color', 'rgba(1, 2, 3, 1)'), true)
  assert.equal(isValidTokenValue('color', 'rgba(1, 2, 3, 1.0)'), true)
  assert.equal(isValidTokenValue('color', 'rgba(1, 2, 3, .5)'), true)
  assert.equal(isValidTokenValue('color', 'rgba(1, 2, 3, 0.05)'), true)
  assert.equal(isValidTokenValue('color', 'rgba(1, 2, 3, 1.5)'), false)
  assert.equal(isValidTokenValue('color', 'rgba(1, 2, 3, 2)'), false)
  assert.equal(isValidTokenValue('color', 'rgba(1, 2, 3, -0.1)'), false)
})

test('injection characters still rejected', () => {
  for (const v of ['red;}body{x:y', '#fff</style>', 'rgba(1,2,3,0.5)/*']) {
    assert.equal(isValidTokenValue('color', v, '--afa-amber'), false, v)
  }
})

// --- B. contrast guard -----------------------------------------------------

test('muted text at 0.3 alpha fails on page and raised surface', () => {
  const after = { ...DEFAULT_TOKEN_VALUES, '--afa-text-muted': 'rgba(245, 245, 240, 0.3)' }
  const fails = contrastFailures(DEFAULT_TOKEN_VALUES, after)
  assert.deepEqual(fails.map((f) => f.label).sort(), ['Muted text on page', 'Muted text on raised surface'])
  for (const f of fails) {
    assert.ok(f.before !== null && f.before >= 4.5)
    assert.ok(f.after < 4.5)
    assert.equal(f.min, 4.5)
  }
})

test('defaults -> defaults reports nothing (pre-existing failures do not block)', () => {
  assert.deepEqual(contrastFailures(DEFAULT_TOKEN_VALUES, DEFAULT_TOKEN_VALUES), [])
})

// GEN-2609-115 - form-submit was the last failing pair (cream on fill,
// 2.81:1); the editor's contrast panel should show none.
test('every contrast pair passes at defaults', () => {
  for (const p of CONTRAST_PAIRS) {
    const r = pairRatio(p, DEFAULT_TOKEN_VALUES)!
    assert.ok(r >= contrastMinimum(p), `${p.label}: ${r.toFixed(2)}`)
  }
})

test('an already-failing pair made worse is reported; made better is not', () => {
  // No default pair fails, so start from muted text at 0.3 (below AA).
  const failing = { ...DEFAULT_TOKEN_VALUES, '--afa-text-muted': 'rgba(245, 245, 240, 0.3)' }
  const worse = { ...failing, '--afa-text-muted': 'rgba(245, 245, 240, 0.25)' }
  assert.ok(contrastFailures(failing, worse).some((f) => f.label === 'Muted text on page'))
  const better = { ...failing, '--afa-text-muted': 'rgba(245, 245, 240, 0.35)' }
  assert.ok(!contrastFailures(failing, better).some((f) => f.label === 'Muted text on page'))
})

test('var() indirection is resolved (on-fill-solid -> brown-black)', () => {
  const after = { ...DEFAULT_TOKEN_VALUES, '--afa-brown-black': '#C0503A' }
  assert.ok(contrastFailures(DEFAULT_TOKEN_VALUES, after).some((f) => f.label === 'Primary button text on fill'))
})

test('translucent backgrounds are composited over their surface', () => {
  const tint = CONTRAST_PAIRS.find((p) => p.label === 'Error badge text on its tint')!
  const composited = pairRatio(tint, DEFAULT_TOKEN_VALUES)!
  // Error tint at 0.1 over #141414 is close to the page itself, so the
  // ratio must sit near error-bright-on-page, not error-bright on the
  // opaque tint hue.
  const onPage = contrastRatio(DEFAULT_TOKEN_VALUES['--afa-error-bright'], DEFAULT_TOKEN_VALUES['--afa-surface-page'])!
  const onOpaqueHue = contrastRatio(DEFAULT_TOKEN_VALUES['--afa-error-bright'], '#B3261E')!
  assert.ok(Math.abs(composited - onPage) < 1, `${composited} vs ${onPage}`)
  assert.ok(composited > onOpaqueHue + 1)
})

test('large pairs use 3:1', () => {
  assert.equal(contrastMinimum({ fg: 'a', bg: 'b', label: 'x', large: true }), 3)
  assert.equal(contrastMinimum({ fg: 'a', bg: 'b', label: 'x' }), 4.5)
})

test('every contrast pair references real tokens and resolves at defaults', () => {
  for (const p of CONTRAST_PAIRS) {
    for (const k of [p.fg, p.bg, p.over].filter(Boolean) as string[]) assert.ok(k in DEFAULT_TOKEN_VALUES, k)
    assert.notEqual(pairRatio(p, DEFAULT_TOKEN_VALUES), null, p.label)
  }
})

// --- C. labels ----------------------------------------------------------------

test('every token has a label and a used-for line', () => {
  const missing = Object.keys(DEFAULT_TOKEN_VALUES).filter((k) => !TOKEN_META[k]?.label || !TOKEN_META[k]?.usedFor)
  assert.deepEqual(missing, [])
})

test('no label entries for tokens that do not exist', () => {
  assert.deepEqual(Object.keys(TOKEN_META).filter((k) => !(k in DEFAULT_TOKEN_VALUES)), [])
})

test('every colour token sits in a known colour subsection; nothing else does', () => {
  const ids = new Set(COLOR_SECTIONS.map((s) => s.id))
  for (const k of Object.keys(DEFAULT_TOKEN_VALUES)) {
    const isColor = typeOf(k) === 'color'
    const section = TOKEN_META[k].section
    if (isColor) assert.ok(section && ids.has(section), k)
    else assert.equal(section, undefined, k)
  }
})

test('search matches label, raw key and used-for, case-insensitively', () => {
  assert.ok(tokenMatches('--afa-text-muted', 'MUTED TEXT'))
  assert.ok(tokenMatches('--afa-text-muted', '--afa-text-mu'))
  assert.ok(tokenMatches('--afa-text-muted', 'timestamps'))
  assert.ok(!tokenMatches('--afa-text-muted', 'pill'))
  assert.ok(tokenMatches('--afa-text-muted', '  '))
})

// --- D. rgba composition --------------------------------------------------------

test('composeRgba writes the DB spaced form, alpha trimmed to 2 places', () => {
  assert.equal(composeRgba(245, 245, 240, 0.5), 'rgba(245, 245, 240, 0.5)')
  assert.equal(composeRgba(245, 245, 240, 0.08), 'rgba(245, 245, 240, 0.08)')
  assert.equal(composeRgba(0, 0, 0, 1), 'rgba(0, 0, 0, 1)')
  assert.equal(composeRgba(0, 0, 0, 0), 'rgba(0, 0, 0, 0)')
  assert.equal(composeRgba(0, 0, 0, 0.3000000004), 'rgba(0, 0, 0, 0.3)')
  assert.equal(formatAlpha(1.4), '1')
  assert.equal(formatAlpha(-1), '0')
})

test('every composed value round-trips through the validator and parser', () => {
  for (let i = 0; i <= 100; i++) {
    const v = composeRgba(201, 151, 58, i / 100)
    assert.ok(isValidTokenValue('color', v, '--afa-amber-tint'), v)
    assert.equal(parseCssColor(v)![3], Number(formatAlpha(i / 100)))
  }
})

test('every default rgba token already is in composeRgba form', () => {
  for (const [k, v] of Object.entries(DEFAULT_TOKEN_VALUES)) {
    if (!v.startsWith('rgba(')) continue
    const [r, g, b, a] = parseCssColor(v)!
    assert.equal(composeRgba(r, g, b, a), v, k)
  }
})

test('rgbToHex feeds the native picker', () => {
  assert.equal(rgbToHex([245, 245, 240, 0.5]), '#F5F5F0')
  assert.equal(rgbToHex([0, 10, 255, 1]), '#000AFF')
})

// --- G. restore (BUG-2609-061) -------------------------------------------------

const LIVE = Object.entries(DEFAULT_TOKEN_VALUES).map(([key, value]) => ({ key, value, type: typeOf(key) }))

test('restore note is flat and uses the real diff count', () => {
  assert.equal(restoreNote('cmuhmxlcc000004jnnx0hiypl', 2), 'Restored version cmuhmxlcc000004jnnx0hiypl (2 token(s) changed)')
})

test('restore: only differing keys change; the count is the real diff', () => {
  const snapshot = { ...DEFAULT_TOKEN_VALUES, '--afa-amber': '#D0A040', '--afa-radius-md': '10px' }
  const plan = planRestore(snapshot, LIVE)
  assert.deepEqual(plan.changes.map((c) => c.key).sort(), ['--afa-amber', '--afa-radius-md'])
  assert.equal(plan.after['--afa-amber'], '#D0A040')
  assert.deepEqual(plan.skipped, [])
  assert.deepEqual(plan.newerKeys, [])
})

test('restore: tokens newer than the snapshot are reported and left untouched', () => {
  const snapshot: Record<string, string> = { ...DEFAULT_TOKEN_VALUES, '--afa-amber': '#D0A040' }
  delete snapshot['--afa-scrim']
  delete snapshot['--afa-tint-30']
  const live = LIVE.map((t) => (t.key === '--afa-scrim' ? { ...t, value: 'rgba(10, 10, 10, 0.6)' } : t))
  const plan = planRestore(snapshot, live)
  assert.deepEqual(plan.newerKeys.sort(), ['--afa-scrim', '--afa-tint-30'])
  assert.equal(plan.after['--afa-scrim'], 'rgba(10, 10, 10, 0.6)')
  assert.equal(plan.changes.length, 1)
  // the new version row gets the full live set, newer keys included
  assert.equal(Object.keys(plan.after).length, LIVE.length)
})

test('restore: values today\'s rules reject are skipped (real QA snapshot values)', () => {
  const snapshot = { ...DEFAULT_TOKEN_VALUES, '--afa-radius-pill': '0100000px', '--afa-radius-md': '200px', '--afa-amber': '#D0A040' }
  const plan = planRestore(snapshot, LIVE)
  assert.deepEqual(plan.skipped.map((s) => s.key).sort(), ['--afa-radius-md', '--afa-radius-pill'])
  assert.deepEqual(plan.changes.map((c) => c.key), ['--afa-amber'])
  assert.equal(plan.after['--afa-radius-md'], '8px')
})

test('restore: snapshot keys that are no longer tokens are ignored', () => {
  const plan = planRestore({ ...DEFAULT_TOKEN_VALUES, '--afa-radius-10px': '10px' }, LIVE)
  assert.equal(plan.changes.length, 0)
  assert.equal('--afa-radius-10px' in plan.after, false)
})

// --- H. restore contrast check (GEN-2609-115) ----------------------------------

test('restore: an old snapshot with muted text at 0.4 needs the contrast confirm', () => {
  // Modelled on QA row cmuhmxlcc: pre-#708, muted 0.4.
  const snapshot = { ...DEFAULT_TOKEN_VALUES, '--afa-text-muted': 'rgba(245, 245, 240, 0.4)' }
  const fails = restoreContrastFailures(planRestore(snapshot, LIVE), LIVE)
  assert.deepEqual(fails.map((f) => f.label).sort(), ['Muted text on page', 'Muted text on raised surface'])
  for (const f of fails) assert.ok(f.before !== null && f.before >= 4.5 && f.after < 4.5)
})

test('restore: a snapshot that keeps every pair at AA needs no confirm', () => {
  const snapshot = { ...DEFAULT_TOKEN_VALUES, '--afa-radius-md': '10px', '--afa-amber': '#D0A040' }
  assert.deepEqual(restoreContrastFailures(planRestore(snapshot, LIVE), LIVE), [])
})

test('restore: values the plan skips are not counted against contrast', () => {
  // A snapshot value today's rules reject never reaches plan.after.
  const snapshot = { ...DEFAULT_TOKEN_VALUES, '--afa-text-muted': 'rgba(245, 245, 240, 4)' }
  const plan = planRestore(snapshot, LIVE)
  assert.equal(plan.skipped.length, 1)
  assert.deepEqual(restoreContrastFailures(plan, LIVE), [])
})

test('restore: live values that already fail and are not worsened do not block', () => {
  const failingLive = LIVE.map((t) => (t.key === '--afa-text-muted' ? { ...t, value: 'rgba(245, 245, 240, 0.3)' } : t))
  const snapshot = { ...DEFAULT_TOKEN_VALUES, '--afa-text-muted': 'rgba(245, 245, 240, 0.4)' }
  // 0.3 -> 0.4 improves an already-failing pair: no confirm.
  assert.deepEqual(restoreContrastFailures(planRestore(snapshot, failingLive), failingLive), [])
})

// --- I. snapshot versions (GEN-2609-115) -----------------------------------------

test('snapshot note: "Snapshot: <reason>", whitespace collapsed', () => {
  assert.equal(snapshotNote('after #710 SQL'), 'Snapshot: after #710 SQL')
  assert.equal(snapshotNote('  after\n  #710   SQL '), 'Snapshot: after #710 SQL')
})

test('snapshot note: reason required, a string, at most 200 chars', () => {
  for (const bad of [undefined, null, 42, '', '   ', 'x'.repeat(SNAPSHOT_REASON_MAX + 1)]) {
    assert.equal(snapshotNote(bad), null, String(bad))
  }
  assert.equal(snapshotNote('x'.repeat(SNAPSHOT_REASON_MAX)), `Snapshot: ${'x'.repeat(SNAPSHOT_REASON_MAX)}`)
})

// --- J. colour resolver for downloads (GEN-2609-119) ------------------------------

test('resolve: a saved concrete value wins over the default', () => {
  assert.equal(resolveColorValue({ '--afa-fill-solid': '#00E5FF' }, '--afa-fill-solid'), '#00E5FF')
  assert.equal(resolveColorValue({ '--afa-text-muted': 'rgba(1, 2, 3, 0.4)' }, '--afa-text-muted'), 'rgba(1, 2, 3, 0.4)')
})

test('resolve: a key with no saved row falls back to its default', () => {
  assert.equal(resolveColorValue({}, '--afa-fill-solid'), DEFAULT_TOKEN_VALUES['--afa-fill-solid'])
  assert.equal(resolveColorValue({ '--afa-amber': '#111111' }, '--afa-surface-page'), DEFAULT_TOKEN_VALUES['--afa-surface-page'])
})

test('resolve: var() chains are followed, through saved values and defaults', () => {
  // default chain: --afa-selected -> var(--afa-amber) -> #C9973A
  assert.equal(resolveColorValue({}, '--afa-selected'), DEFAULT_TOKEN_VALUES['--afa-amber'])
  // the saved amber is what the default var() lands on
  assert.equal(resolveColorValue({ '--afa-amber': '#123456' }, '--afa-selected'), '#123456')
  // three saved hops
  const values = { '--afa-selected': 'var(--afa-fill-solid)', '--afa-fill-solid': 'var(--afa-amber)', '--afa-amber': 'var(--afa-sage)', '--afa-sage': '#0A0B0C' }
  assert.equal(resolveColorValue(values, '--afa-selected'), '#0A0B0C')
})

test('resolve: a cycle falls back to the defaults, never loops', () => {
  const values = { '--afa-fill-solid': 'var(--afa-amber)', '--afa-amber': 'var(--afa-fill-solid)' }
  assert.equal(resolveColorValue(values, '--afa-fill-solid'), DEFAULT_TOKEN_VALUES['--afa-fill-solid'])
  assert.equal(resolveColorValue({ '--afa-amber': 'var(--afa-amber)' }, '--afa-amber'), DEFAULT_TOKEN_VALUES['--afa-amber'])
})

test('resolve: a chain past the depth limit falls back to the defaults', () => {
  const values: Record<string, string> = {}
  for (let i = 0; i <= COLOR_RESOLVE_MAX_DEPTH + 1; i++) values[`--x-${i}`] = `var(--x-${i + 1})`
  values[`--x-${COLOR_RESOLVE_MAX_DEPTH + 2}`] = '#ABCDEF'
  values['--afa-fill-solid'] = 'var(--x-0)'
  assert.equal(resolveColorValue(values, '--afa-fill-solid'), DEFAULT_TOKEN_VALUES['--afa-fill-solid'])
  // one hop inside the limit still resolves
  assert.equal(resolveColorValue({ ...values, '--afa-fill-solid': `var(--x-${COLOR_RESOLVE_MAX_DEPTH + 2})` }, '--afa-fill-solid'), '#ABCDEF')
})

test('resolve: a dangling ref or a non-colour value falls back to the default', () => {
  assert.equal(resolveColorValue({ '--afa-fill-solid': 'var(--afa-gone)' }, '--afa-fill-solid'), DEFAULT_TOKEN_VALUES['--afa-fill-solid'])
  assert.equal(resolveColorValue({ '--afa-fill-solid': '12px' }, '--afa-fill-solid'), DEFAULT_TOKEN_VALUES['--afa-fill-solid'])
  assert.equal(resolveColorValue({ '--afa-fill-solid': '' }, '--afa-fill-solid'), DEFAULT_TOKEN_VALUES['--afa-fill-solid'])
})

test('resolve: a key no table knows gives the unresolved colour', () => {
  assert.equal(resolveColorValue({}, '--afa-not-a-token'), UNRESOLVED_COLOR)
  // a non-colour token is not a colour either
  assert.equal(resolveColorValue({}, '--afa-space-4'), UNRESOLVED_COLOR)
})

test('resolve: every default colour token resolves to a parseable colour', () => {
  for (const key of Object.keys(TOKEN_META)) {
    if (!TOKEN_META[key].section) continue
    const v = resolveColorValue({}, key)
    assert.ok(parseCssColor(v), `${key} -> ${v}`)
    assert.ok(!v.startsWith('var('), key)
  }
})

test('toPdfRgb: hex, short hex, rgb() and rgba() become 0..1 channels plus opacity', () => {
  assert.deepEqual(toPdfRgb('#FF0080'), { r: 1, g: 0, b: 128 / 255, opacity: 1 })
  assert.deepEqual(toPdfRgb('#fff'), { r: 1, g: 1, b: 1, opacity: 1 })
  assert.deepEqual(toPdfRgb('rgb(255, 90, 54)'), { r: 1, g: 90 / 255, b: 54 / 255, opacity: 1 })
  assert.deepEqual(toPdfRgb('rgba(245, 245, 240, 0.5)'), { r: 245 / 255, g: 245 / 255, b: 240 / 255, opacity: 0.5 })
  assert.deepEqual(toPdfRgb('rgba(0, 0, 0, 0)'), { r: 0, g: 0, b: 0, opacity: 0 })
})

test('toPdfRgb: an unparseable value gives the unresolved colour, not NaN', () => {
  assert.deepEqual(toPdfRgb('var(--afa-amber)'), toPdfRgb(UNRESOLVED_COLOR))
  assert.deepEqual(toPdfRgb('nonsense'), { r: 0, g: 0, b: 0, opacity: 1 })
})

console.log(`\n${passed} passed`)
