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
  isValidTokenValue,
  radiusOrderErrors,
  rangeFor,
  tokenValueError,
  type TokenType,
} from '../src/lib/design-tokens'

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

test('font sizes 10-72px; running-text roles 11-24px', () => {
  assert.equal(tokenValueError('--afa-text-page-title-lg', 'dimension', '72px'), null)
  assert.notEqual(tokenValueError('--afa-text-page-title-lg', 'dimension', '73px'), null)
  assert.notEqual(tokenValueError('--afa-text-caption', 'dimension', '9px'), null)
  assert.equal(tokenValueError('--afa-text-caption', 'dimension', '10px'), null)
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

console.log(`\n${passed} passed`)
