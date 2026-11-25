// Artist (D3) direct-pay cancel after CONFIRMED + refund tracking (Hitesh, 12 Nov).
// Regression shape: on origin/qa performanceRefundTransition /
// performanceCancelConfirmedData do not exist and a CONFIRMED performance
// can't be cancelled through the direct-pay state machine, so this fails;
// on the branch it passes.
//
//   npx tsx scripts/performance-direct-pay-refund.test.ts
import assert from 'node:assert/strict'
import {
  performanceActor,
  performanceCancelConfirmedData,
  performanceCancelledPushBody,
  performanceDirection,
  performanceDirectPayTransition,
  performanceRefundTransition,
} from '../src/lib/performance-direct-pay'
import { DIRECT_PAY_FULL_REFUND_MIN_DAYS } from '../src/lib/direct-pay-terms'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const H = 60 * 60 * 1000
const D = 24 * H
// 1 Nov 2026 12:00 IST
const NOW = Date.UTC(2026, 10, 1, 6, 30, 0)
const IST = (y: number, m: number, d: number, h = 0) => Date.UTC(y, m, d, h) - 330 * 60 * 1000
const PAID = { compensationType: 'PAID', feeAmount: 1500, buyInAmount: null }
const BUY_IN = { compensationType: 'BUY_IN', feeAmount: null, buyInAmount: 200 }

// ---- payer by direction ----
test('PAID: the organiser is the payer; BUY_IN: the artist is the payer', () => {
  assert.equal(performanceDirection(PAID)?.payer, 'ORGANISER')
  assert.equal(performanceDirection(BUY_IN)?.payer, 'ARTIST')
})

test('refundReceived: PAID payer (organiser) DUE -> RECEIVED, AS_AGREED -> RECEIVED', () => {
  assert.deepEqual(performanceRefundTransition({ ...PAID, directRefundStatus: 'DUE' }, 'ORGANISER'), { ok: true, next: 'RECEIVED' })
  assert.deepEqual(performanceRefundTransition({ ...PAID, directRefundStatus: 'AS_AGREED' }, 'ORGANISER'), { ok: true, next: 'RECEIVED' })
})

test('refundReceived: BUY_IN payer (artist) DUE -> RECEIVED', () => {
  assert.deepEqual(performanceRefundTransition({ ...BUY_IN, directRefundStatus: 'DUE' }, 'ARTIST'), { ok: true, next: 'RECEIVED' })
})

test('refundReceived: 403 for the non-payer, naming the payer', () => {
  const a = performanceRefundTransition({ ...PAID, directRefundStatus: 'DUE' }, 'ARTIST')
  assert.equal(a.ok, false)
  if (!a.ok) {
    assert.equal(a.status, 403)
    assert.match(a.error, /Only the organiser/)
  }
  const b = performanceRefundTransition({ ...BUY_IN, directRefundStatus: 'AS_AGREED' }, 'ORGANISER')
  assert.equal(b.ok, false)
  if (!b.ok) {
    assert.equal(b.status, 403)
    assert.match(b.error, /Only the artist/)
  }
})

test('refundReceived: second tap 400, nothing to refund 400', () => {
  const again = performanceRefundTransition({ ...PAID, directRefundStatus: 'RECEIVED' }, 'ORGANISER')
  assert.equal(again.ok === false && again.status, 400)
  const none = performanceRefundTransition({ ...BUY_IN, directRefundStatus: null }, 'ARTIST')
  assert.equal(none.ok === false && none.status, 400)
  if (!none.ok) assert.match(none.error, /performance/)
})

// ---- the transition table for cancelConfirmed ----
const start = IST(2026, 11, 1, 20) // 1 Dec 20:00 IST

test('cancelConfirmed: either party, CONFIRMED and before the event starts -> CANCELLED', () => {
  for (const terms of [PAID, BUY_IN]) {
    for (const actor of ['ORGANISER', 'ARTIST'] as const) {
      assert.deepEqual(
        performanceDirectPayTransition({ ...terms, directPayStatus: 'CONFIRMED' }, 'cancelConfirmed', actor, { eventStart: start, now: NOW }),
        { ok: true, next: 'CANCELLED' }
      )
    }
  }
})

test('cancelConfirmed: refused from any non-CONFIRMED step', () => {
  for (const st of ['AWAITING_PAYMENT', 'PAID_MARKED', 'CANCELLED', 'EXPIRED', null]) {
    const t = performanceDirectPayTransition({ ...PAID, directPayStatus: st }, 'cancelConfirmed', 'ORGANISER', { eventStart: start, now: NOW })
    assert.equal(t.ok === false && t.status, 400, String(st))
  }
})

test('cancelConfirmed: refused once the event has started, and without a start', () => {
  const t = performanceDirectPayTransition({ ...PAID, directPayStatus: 'CONFIRMED' }, 'cancelConfirmed', 'ARTIST', { eventStart: start, now: start })
  assert.equal(t.ok, false)
  if (!t.ok) assert.match(t.error, /performance has already started/)
  const u = performanceDirectPayTransition({ ...PAID, directPayStatus: 'CONFIRMED' }, 'cancelConfirmed', 'ARTIST')
  assert.equal(u.ok, false)
})

test('existing waiting-step rules unchanged (cancel from CONFIRMED still refused)', () => {
  const t = performanceDirectPayTransition({ ...PAID, directPayStatus: 'CONFIRMED' }, 'cancel', 'ORGANISER')
  assert.equal(t.ok === false && t.error, 'This performance is no longer waiting on payment.')
})

test('actor for a user on both sides: cancelConfirmed / refundReceived act as the payer', () => {
  assert.equal(performanceActor(BUY_IN, 'refundReceived', true, true), 'ARTIST')
  assert.equal(performanceActor(PAID, 'cancelConfirmed', true, true), 'ORGANISER')
})

// ---- the outcome data ----
test(`cancel ${DIRECT_PAY_FULL_REFUND_MIN_DAYS}+ IST days before the event date -> DUE`, () => {
  const now = new Date(NOW)
  const d = performanceCancelConfirmedData({ confirmedAt: new Date(NOW - D) }, IST(2026, 10, 16), 'ORGANISER', now)
  assert.deepEqual(d, { cancelledAt: now, cancelledBy: 'ORGANISER', directPayStatus: 'CANCELLED', directRefundStatus: 'DUE' })
  assert.equal('buyInRefundStatus' in d, false)
})

test('cancel inside the window -> AS_AGREED, cancelledBy is the actor', () => {
  const d = performanceCancelConfirmedData({ confirmedAt: new Date(NOW - D) }, IST(2026, 10, 15), 'ARTIST', new Date(NOW))
  assert.equal(d.directRefundStatus, 'AS_AGREED')
  assert.equal(d.cancelledBy, 'ARTIST')
})

test('no confirmed receipt -> no refund status', () => {
  const d = performanceCancelConfirmedData({ confirmedAt: null }, IST(2026, 11, 25), 'ARTIST', new Date(NOW))
  assert.equal(d.directRefundStatus, null)
})

test('push copy states the outcome', () => {
  assert.match(performanceCancelledPushBody('Open Mic', 200, 'DUE', 15), /₹200 .*due under the 15-day term/)
  assert.match(performanceCancelledPushBody('Open Mic', 200, 'AS_AGREED', 15), /inside 15 days.*as you both agree/)
  assert.equal(performanceCancelledPushBody('Open Mic', 200, null, 15), 'The confirmed slot at "Open Mic" was cancelled.')
})

console.log(`\n${passed} passed`)
