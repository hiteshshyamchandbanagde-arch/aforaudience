// BUG-2609-051 - self-tests for the Direct payouts expiry check in
// src/lib/direct-payouts.ts, shared by the payout API routes and the admin
// Settings page (which showed a lapsed flag as ON). Run with tsx:
//
//   npx tsx scripts/direct-payouts.test.ts
import assert from 'node:assert/strict'
import { directPayoutsExpiredAt, isDirectPayoutsEnabled } from '../src/lib/direct-payouts'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const NOW = new Date('2026-10-12T06:00:00.000Z').getTime()
const HOUR = 60 * 60 * 1000
const PAST = new Date(NOW - HOUR)
const FUTURE = new Date(NOW + HOUR)

test('[BUG-2609-051] stored ON with a date that has passed: effectively OFF, expiry date reported', () => {
  const s = { directPayoutsEnabled: true, directPayoutsEnabledUntil: PAST }
  assert.equal(isDirectPayoutsEnabled(s, NOW), false)
  assert.equal(directPayoutsExpiredAt(s, NOW)?.getTime(), PAST.getTime())
})

test('[BUG-2609-051] the settings API sends the date as an ISO string: same answer', () => {
  const s = { directPayoutsEnabled: true, directPayoutsEnabledUntil: PAST.toISOString() }
  assert.equal(isDirectPayoutsEnabled(s, NOW), false)
  assert.equal(directPayoutsExpiredAt(s, NOW)?.toISOString(), PAST.toISOString())
})

test('exactly at the auto-disable time it is already OFF', () => {
  const s = { directPayoutsEnabled: true, directPayoutsEnabledUntil: new Date(NOW) }
  assert.equal(isDirectPayoutsEnabled(s, NOW), false)
  assert.notEqual(directPayoutsExpiredAt(s, NOW), null)
})

test('stored ON with a date still ahead: ON, not expired', () => {
  const s = { directPayoutsEnabled: true, directPayoutsEnabledUntil: FUTURE.toISOString() }
  assert.equal(isDirectPayoutsEnabled(s, NOW), true)
  assert.equal(directPayoutsExpiredAt(s, NOW), null)
})

test('stored ON with no date: ON, never expires', () => {
  const s = { directPayoutsEnabled: true, directPayoutsEnabledUntil: null }
  assert.equal(isDirectPayoutsEnabled(s, NOW), true)
  assert.equal(directPayoutsExpiredAt(s, NOW), null)
})

test('stored OFF: OFF and not "expired", whatever the date', () => {
  for (const until of [null, PAST, FUTURE.toISOString()]) {
    const s = { directPayoutsEnabled: false, directPayoutsEnabledUntil: until }
    assert.equal(isDirectPayoutsEnabled(s, NOW), false)
    assert.equal(directPayoutsExpiredAt(s, NOW), null)
  }
})

console.log(`\n${passed} passed`)
