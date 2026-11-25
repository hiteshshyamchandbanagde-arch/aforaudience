// BUG-2609-086 - self-tests for the audience refund tiers in
// src/lib/refund-policy.ts, shared by PATCH /api/bookings/[id] (the real
// refund) and the My Tickets cancel sheet (the preview). Run with tsx:
//
//   npx tsx scripts/refund-policy.test.ts
import assert from 'node:assert/strict'
import { computeRefund, eventStartInstant } from '../src/lib/refund-policy'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-10-07T06:00:00.000Z')
const daysOut = (d: number) => new Date(NOW.getTime() + d * DAY)
// Hitesh's 7 Oct booking: ₹1,000 ticket + ₹20 booking fee.
const PAID = { totalAmount: 1020, bookingFeeAmount: 20 }

test('[BUG-2609-086] 14+ days out: refund is paid minus the booking fee, fee is named as withheld', () => {
  assert.deepEqual(computeRefund(PAID, daysOut(30), NOW), { tier: '14plus', paid: 1020, refund: 1000, bookingFee: 20, feeWithheld: true })
})

test('exactly 14 days out is still the 14+ tier', () => {
  assert.equal(computeRefund(PAID, daysOut(14), NOW).tier, '14plus')
})

test('just under 14 days out is the 50% tier, on the full amount paid', () => {
  const r = computeRefund(PAID, daysOut(13.99), NOW)
  assert.equal(r.tier, '50pct')
  assert.equal(r.refund, 510)
  assert.equal(r.feeWithheld, false)
})

test('exactly 7 days out is the 50% tier; just under is no refund', () => {
  assert.equal(computeRefund(PAID, daysOut(7), NOW).tier, '50pct')
  const r = computeRefund(PAID, daysOut(6.99), NOW)
  assert.equal(r.tier, 'under7')
  assert.equal(r.refund, 0)
})

test('a show that has started is past, never "less than 7 days"', () => {
  assert.equal(computeRefund(PAID, NOW, NOW).tier, 'past')
  assert.equal(computeRefund(PAID, daysOut(-2), NOW).refund, 0)
})

test('a free ticket refunds nothing and withholds nothing', () => {
  assert.deepEqual(computeRefund({ totalAmount: 0, bookingFeeAmount: 0 }, daysOut(30), NOW), { tier: 'free', paid: 0, refund: 0, bookingFee: 0, feeWithheld: false })
})

test('no booking fee: 14+ tier refunds everything and names no withheld fee', () => {
  const r = computeRefund({ totalAmount: 250, bookingFeeAmount: 0 }, daysOut(30), NOW)
  assert.equal(r.refund, 250)
  assert.equal(r.feeWithheld, false)
})

test('the refund is never negative', () => {
  assert.equal(computeRefund({ totalAmount: 10, bookingFeeAmount: 20 }, daysOut(30), NOW).refund, 0)
})

test('eventStartInstant puts the start time on the event date', () => {
  const s = eventStartInstant('2026-12-04T13:00:00.000Z', '18:30')
  assert.equal(s.getHours(), 18)
  assert.equal(s.getMinutes(), 30)
})

console.log(`\n${passed} passed.`)
