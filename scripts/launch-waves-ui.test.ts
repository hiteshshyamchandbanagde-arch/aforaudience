// S1b-b2 (Hitesh, 9 Nov) - self-tests for the launch wave UI helpers in
// src/lib/launch-waves-ui.ts (403 WAVE_CLOSED -> friendly line, the
// "Tickets open soon" vs "Booking opens soon" decision, W4 control blocks,
// admin bypass). Regression shape: on origin/qa the module does not exist,
// so this fails; on the branch it passes.
//
//   npx tsx scripts/launch-waves-ui.test.ts
import assert from 'node:assert/strict'
import {
  ALL_WAVES_OPEN,
  WAVE_MESSAGE_KEY,
  bookingSoonState,
  paymentTypeBlocked,
  venueAmountBlocked,
  waveErrorMessage,
  waveFromErrorBody,
  wavesForViewer,
} from '../src/lib/launch-waves-ui'
import { WAVES, waveClosedBody } from '../src/lib/launch-waves'
import en from '../src/lib/i18n/dictionaries/en'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const MSG = { closedW1: 'm1', closedW2: 'm2', closedW3: 'm3', closedW4: 'm4' }

test('each wave 403 body maps to its own message', () => {
  for (const w of WAVES) {
    assert.equal(waveFromErrorBody(waveClosedBody(w)), w)
    assert.equal(waveErrorMessage(waveClosedBody(w), MSG, 'fb'), MSG[WAVE_MESSAGE_KEY[w]])
  }
})

test('unknown code passes its error string through', () => {
  assert.equal(waveErrorMessage({ error: 'Event is full', code: 'SOLD_OUT' }, MSG, 'fb'), 'Event is full')
  assert.equal(waveFromErrorBody({ error: 'x', code: 'SOLD_OUT', wave: 'W3' }), null)
})

test('WAVE_CLOSED with an unknown wave falls back to error/fallback', () => {
  assert.equal(waveFromErrorBody({ code: 'WAVE_CLOSED', wave: 'W9' }), null)
  assert.equal(waveErrorMessage({ code: 'WAVE_CLOSED', wave: 'W9', error: 'raw' }, MSG, 'fb'), 'raw')
})

test('missing / non-object / empty bodies use the fallback', () => {
  assert.equal(waveErrorMessage(null, MSG, 'fb'), 'fb')
  assert.equal(waveErrorMessage('nope', MSG, 'fb'), 'fb')
  assert.equal(waveErrorMessage({}, MSG, 'fb'), 'fb')
  assert.equal(waveErrorMessage({ error: '  ' }, MSG, 'fb'), 'fb')
})

test('en dictionary has every wave message key', () => {
  for (const w of WAVES) {
    const v = (en.launchWaves as Record<string, string>)[WAVE_MESSAGE_KEY[w]]
    assert.ok(typeof v === 'string' && v.length > 0, `missing ${WAVE_MESSAGE_KEY[w]}`)
  }
})

test('admin viewer sees every wave open', () => {
  assert.deepEqual(wavesForViewer({ W1: false, W2: false, W3: false, W4: false }, true), ALL_WAVES_OPEN)
})

test('non-admin sees the hint; missing hint / key = open (server still enforces)', () => {
  assert.deepEqual(wavesForViewer({ W1: true, W2: false, W3: true, W4: false }, false), { W1: true, W2: false, W3: true, W4: false })
  assert.deepEqual(wavesForViewer(null, false), ALL_WAVES_OPEN)
  assert.deepEqual(wavesForViewer({ W3: false }, false), { W1: true, W2: true, W3: false, W4: true })
})

test('bookingSoonState: W3 closed wins over paid-paused', () => {
  assert.equal(bookingSoonState({ w3Open: false, paidPaused: true }), 'W3')
  assert.equal(bookingSoonState({ w3Open: false, paidPaused: false }), 'W3')
  assert.equal(bookingSoonState({ w3Open: true, paidPaused: true }), 'PAID')
  assert.equal(bookingSoonState({ w3Open: true, paidPaused: false }), null)
})

test('paymentTypeBlocked: PAID/BUY_IN blocked only while W4 closed; FREE never', () => {
  assert.equal(paymentTypeBlocked('PAID', false), true)
  assert.equal(paymentTypeBlocked('BUY_IN', false), true)
  assert.equal(paymentTypeBlocked('FREE', false), false)
  assert.equal(paymentTypeBlocked('PAID', true), false)
  assert.equal(paymentTypeBlocked('BUY_IN', true), false)
})

test('venueAmountBlocked: amount > 0 blocked only while W4 closed', () => {
  assert.equal(venueAmountBlocked(500, false), true)
  assert.equal(venueAmountBlocked('500', false), true)
  assert.equal(venueAmountBlocked(0, false), false)
  assert.equal(venueAmountBlocked('', false), false)
  assert.equal(venueAmountBlocked(undefined, false), false)
  assert.equal(venueAmountBlocked('abc', false), false)
  assert.equal(venueAmountBlocked(500, true), false)
})

console.log(`\n${passed} launch-waves-ui self-tests passed`)
