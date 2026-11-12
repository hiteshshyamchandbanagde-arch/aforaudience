// Venue direct-pay cancel after CONFIRMED + refund tracking (Hitesh, 12 Nov).
// Regression shape: on origin/qa cancelConfirmedOutcome / directRefundTransition
// do not exist and directPayTransition refuses every action from CONFIRMED,
// so this fails; on the branch it passes.
//
//   npx tsx scripts/venue-direct-pay-refund.test.ts
import assert from 'node:assert/strict'
import {
  cancelConfirmedOutcome,
  directPayTransition,
  directRefundTransition,
  hasBookingStarted,
  istCalendarDaysUntil,
} from '../src/lib/venue-direct-pay'
import { DIRECT_PAY_FULL_REFUND_MIN_DAYS } from '../src/lib/direct-pay-terms'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const H = 60 * 60 * 1000
const D = 24 * H
// 1 Nov 2026 00:30 IST = 31 Oct 19:00 UTC
const NOW = Date.UTC(2026, 9, 31, 19, 0, 0)
const IST = (y: number, m: number, d: number, h = 0, min = 0) => Date.UTC(y, m, d, h, min) - 330 * 60 * 1000

test('term is 15 days', () => assert.equal(DIRECT_PAY_FULL_REFUND_MIN_DAYS, 15))

// --- IST calendar-day maths ---
test('same IST day = 0 even across UTC midnight', () => {
  // 1 Nov 00:30 IST vs 1 Nov 23:30 IST
  assert.equal(istCalendarDaysUntil(IST(2026, 10, 1, 23, 30), NOW), 0)
})
test('next IST day = 1 even when < 24 h away', () => {
  assert.equal(istCalendarDaysUntil(IST(2026, 10, 2, 0, 10), IST(2026, 10, 1, 23, 50)), 1)
})
test('past date is negative', () => assert.equal(istCalendarDaysUntil(NOW - 2 * D, NOW), -2))

// --- outcome boundaries ---
test('exactly 15 days -> DUE', () => assert.equal(cancelConfirmedOutcome(NOW + 15 * D, NOW, true), 'DUE'))
test('16 days -> DUE', () => assert.equal(cancelConfirmedOutcome(NOW + 16 * D, NOW, true), 'DUE'))
test('14 days 23 h (same clock alignment) -> AS_AGREED', () => {
  // now 1 Nov 00:30 IST, booked 15 Nov 23:30 IST = 14 calendar days
  assert.equal(cancelConfirmedOutcome(NOW + 14 * D + 23 * H, NOW, true), 'AS_AGREED')
})
test('15 IST calendar days counts even if a few hours short of 15x24 h', () => {
  // now 1 Nov 23:30 IST, booked 16 Nov 00:30 IST: 14 d 1 h, but 15 calendar days
  assert.equal(cancelConfirmedOutcome(IST(2026, 10, 16, 0, 30), IST(2026, 10, 1, 23, 30), true), 'DUE')
})
test('booked tomorrow -> AS_AGREED', () => assert.equal(cancelConfirmedOutcome(NOW + D, NOW, true), 'AS_AGREED'))
test('nothing paid -> null, far out', () => assert.equal(cancelConfirmedOutcome(NOW + 30 * D, NOW, false), null))
test('nothing paid -> null, inside window', () => assert.equal(cancelConfirmedOutcome(NOW + D, NOW, false), null))
test('accepts ISO strings', () => {
  assert.equal(cancelConfirmedOutcome(new Date(NOW + 20 * D).toISOString(), new Date(NOW).toISOString(), true), 'DUE')
})

// --- started? ---
test('not started before fromDate', () => assert.equal(hasBookingStarted(NOW + 1, NOW), false))
test('started at fromDate', () => assert.equal(hasBookingStarted(NOW, NOW), true))

// --- cancelConfirmed transition ---
const ctx = { fromDate: NOW + 20 * D, now: NOW }
test('organiser may cancel CONFIRMED before fromDate', () => {
  assert.deepEqual(directPayTransition('CONFIRMED', 'cancelConfirmed', 'ORGANISER', ctx), { ok: true, next: 'CANCELLED' })
})
test('venue owner may cancel CONFIRMED before fromDate', () => {
  assert.deepEqual(directPayTransition('CONFIRMED', 'cancelConfirmed', 'VENUE_OWNER', ctx), { ok: true, next: 'CANCELLED' })
})
test('cancelConfirmed refused once the booking has started (400)', () => {
  const r = directPayTransition('CONFIRMED', 'cancelConfirmed', 'ORGANISER', { fromDate: NOW - H, now: NOW })
  assert.equal(r.ok, false)
  assert.equal(!r.ok && r.status, 400)
})
test('cancelConfirmed refused without a fromDate (400)', () => {
  const r = directPayTransition('CONFIRMED', 'cancelConfirmed', 'ORGANISER')
  assert.equal(!r.ok && r.status, 400)
})
for (const s of ['AWAITING_PAYMENT', 'PAID_MARKED', 'EXPIRED', 'CANCELLED', null]) {
  test(`cancelConfirmed refused from ${s} (400)`, () => {
    const r = directPayTransition(s, 'cancelConfirmed', 'ORGANISER', ctx)
    assert.equal(!r.ok && r.status, 400)
  })
}
test('pre-confirm cancel still refused from CONFIRMED (400)', () => {
  const r = directPayTransition('CONFIRMED', 'cancel', 'ORGANISER')
  assert.equal(!r.ok && r.status, 400)
})
test('pre-confirm cancel still works from PAID_MARKED', () => {
  assert.deepEqual(directPayTransition('PAID_MARKED', 'cancel', 'VENUE_OWNER'), { ok: true, next: 'CANCELLED' })
})
test('refundReceived is not a step transition', () => {
  const r = directPayTransition('CANCELLED', 'refundReceived', 'ORGANISER')
  assert.equal(!r.ok && r.status, 400)
})

// --- refundReceived ---
test('organiser: DUE -> RECEIVED', () => assert.deepEqual(directRefundTransition('DUE', 'ORGANISER'), { ok: true, next: 'RECEIVED' }))
test('organiser: AS_AGREED -> RECEIVED', () => assert.deepEqual(directRefundTransition('AS_AGREED', 'ORGANISER'), { ok: true, next: 'RECEIVED' }))
test('venue owner cannot mark refund received (403)', () => {
  const r = directRefundTransition('DUE', 'VENUE_OWNER')
  assert.equal(!r.ok && r.status, 403)
})
test('second tap is refused (400)', () => {
  const r = directRefundTransition('RECEIVED', 'ORGANISER')
  assert.equal(!r.ok && r.status, 400)
})
test('nothing to refund (null) is refused (400)', () => {
  const r = directRefundTransition(null, 'ORGANISER')
  assert.equal(!r.ok && r.status, 400)
})

console.log(`\n${passed} passed`)
