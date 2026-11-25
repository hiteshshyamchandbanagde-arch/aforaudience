// D3 (Hitesh, 8 Nov) - self-tests for direct-payment performance fees in
// src/lib/performance-direct-pay.ts. Regression shape: on origin/qa this
// module does not exist (an approved PAID/BUY_IN slot records an amount and
// nothing else), so this fails; on the branch it passes.
//
//   npx tsx scripts/performance-direct-pay.test.ts
import assert from 'node:assert/strict'
import {
  performanceActor,
  performanceChip,
  performanceDirection,
  performanceDirectPayCreateData,
  performanceDirectPayTransition,
} from '../src/lib/performance-direct-pay'
import { DIRECT_PAY_EXPIRY_HOURS } from '../src/lib/venue-direct-pay'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const H = 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 8, 12, 0, 0)
const PAID = { compensationType: 'PAID', feeAmount: 1500, buyInAmount: null }
const BUY_IN = { compensationType: 'BUY_IN', feeAmount: null, buyInAmount: 200 }
const FREE = { compensationType: 'FREE', feeAmount: null, buyInAmount: null }

test('PAID: organiser pays the artist the fee', () => {
  assert.deepEqual(performanceDirection(PAID), { payer: 'ORGANISER', payee: 'ARTIST', amount: 1500 })
})

test('BUY_IN: artist pays the organiser the buy-in', () => {
  assert.deepEqual(performanceDirection(BUY_IN), { payer: 'ARTIST', payee: 'ORGANISER', amount: 200 })
})

test('FREE and zero/missing amounts owe nothing', () => {
  assert.equal(performanceDirection(FREE), null)
  assert.equal(performanceDirection({ compensationType: 'PAID', feeAmount: 0 }), null)
  assert.equal(performanceDirection({ compensationType: 'PAID', feeAmount: null }), null)
  assert.equal(performanceDirection({ compensationType: 'BUY_IN', buyInAmount: -5 }), null)
  assert.equal(performanceDirection({ compensationType: undefined }), null)
  // The other direction's amount is ignored.
  assert.equal(performanceDirection({ compensationType: 'PAID', feeAmount: null, buyInAmount: 300 }), null)
})

test('create data: payments OFF -> AWAITING_PAYMENT, DIRECT, 48 h', () => {
  for (const p of [PAID, BUY_IN]) {
    const d = performanceDirectPayCreateData(p, false, undefined, NOW) as { paymentMethod: string; directPayStatus: string; expiresAt: Date }
    assert.equal(d.paymentMethod, 'DIRECT')
    assert.equal(d.directPayStatus, 'AWAITING_PAYMENT')
    assert.equal(d.expiresAt.getTime(), NOW + DIRECT_PAY_EXPIRY_HOURS * H)
    assert.equal(DIRECT_PAY_EXPIRY_HOURS, 48)
  }
})

test('create data: payments ON keeps today\'s behaviour unless DIRECT chosen', () => {
  assert.deepEqual(performanceDirectPayCreateData(PAID, true, undefined, NOW), {})
  assert.deepEqual(performanceDirectPayCreateData(BUY_IN, true, 'ONLINE', NOW), {})
  assert.equal((performanceDirectPayCreateData(PAID, true, 'DIRECT', NOW) as { directPayStatus?: string }).directPayStatus, 'AWAITING_PAYMENT')
})

test('create data: FREE is untouched whatever the switch', () => {
  assert.deepEqual(performanceDirectPayCreateData(FREE, false, 'DIRECT', NOW), {})
  assert.deepEqual(performanceDirectPayCreateData(FREE, true, undefined, NOW), {})
  assert.deepEqual(performanceDirectPayCreateData({ compensationType: 'PAID', feeAmount: null }, false, undefined, NOW), {})
})

test('PAID transitions: organiser marks paid, artist confirms', () => {
  const p = { ...PAID, directPayStatus: 'AWAITING_PAYMENT' }
  assert.deepEqual(performanceDirectPayTransition(p, 'markPaid', 'ORGANISER'), { ok: true, next: 'PAID_MARKED' })
  const r = performanceDirectPayTransition(p, 'markPaid', 'ARTIST')
  assert.equal(r.ok, false)
  assert.equal(!r.ok && r.status, 403)
  assert.match(!r.ok ? r.error : '', /organiser/)
  const m = { ...PAID, directPayStatus: 'PAID_MARKED' }
  assert.deepEqual(performanceDirectPayTransition(m, 'confirmReceived', 'ARTIST'), { ok: true, next: 'CONFIRMED' })
  const c = performanceDirectPayTransition(m, 'confirmReceived', 'ORGANISER')
  assert.equal(!c.ok && c.status, 403)
  assert.match(!c.ok ? c.error : '', /artist/)
})

test('BUY_IN transitions: artist marks paid, organiser confirms', () => {
  const p = { ...BUY_IN, directPayStatus: 'AWAITING_PAYMENT' }
  assert.deepEqual(performanceDirectPayTransition(p, 'markPaid', 'ARTIST'), { ok: true, next: 'PAID_MARKED' })
  assert.equal(performanceDirectPayTransition(p, 'markPaid', 'ORGANISER').ok, false)
  // Cash handed over before the payer taps still counts.
  assert.deepEqual(performanceDirectPayTransition(p, 'confirmReceived', 'ORGANISER'), { ok: true, next: 'CONFIRMED' })
  assert.equal(performanceDirectPayTransition(p, 'confirmReceived', 'ARTIST').ok, false)
})

test('cancel / decline: either side, only before confirm', () => {
  for (const s of ['AWAITING_PAYMENT', 'PAID_MARKED']) {
    for (const a of ['ORGANISER', 'ARTIST'] as const) {
      assert.deepEqual(performanceDirectPayTransition({ ...PAID, directPayStatus: s }, 'cancel', a), { ok: true, next: 'CANCELLED' })
    }
  }
  for (const s of ['CONFIRMED', 'EXPIRED', 'CANCELLED', null]) {
    const r = performanceDirectPayTransition({ ...BUY_IN, directPayStatus: s }, 'cancel', 'ARTIST')
    assert.equal(r.ok, false)
    assert.equal(!r.ok && r.status, 400)
  }
})

test('markPaid twice is refused', () => {
  const r = performanceDirectPayTransition({ ...PAID, directPayStatus: 'PAID_MARKED' }, 'markPaid', 'ORGANISER')
  assert.equal(!r.ok && r.status, 400)
})

test('FREE has no transitions', () => {
  const r = performanceDirectPayTransition({ ...FREE, directPayStatus: 'AWAITING_PAYMENT' }, 'markPaid', 'ORGANISER')
  assert.equal(!r.ok && r.status, 400)
})

test('actor: one role each, and own-event (both) resolves from the action', () => {
  assert.equal(performanceActor(PAID, 'markPaid', true, false), 'ORGANISER')
  assert.equal(performanceActor(PAID, 'markPaid', false, true), 'ARTIST')
  assert.equal(performanceActor(PAID, 'markPaid', false, false), null)
  assert.equal(performanceActor(PAID, 'markPaid', true, true), 'ORGANISER')
  assert.equal(performanceActor(PAID, 'confirmReceived', true, true), 'ARTIST')
  assert.equal(performanceActor(BUY_IN, 'markPaid', true, true), 'ARTIST')
  assert.equal(performanceActor(BUY_IN, 'confirmReceived', true, true), 'ORGANISER')
})

test('chips: 48 h expiry, confirmed, cancelled', () => {
  const exp = new Date(NOW + 48 * H)
  assert.equal(performanceChip({ directPayStatus: 'AWAITING_PAYMENT', expiresAt: exp }, NOW), 'awaitingPayment')
  assert.equal(performanceChip({ directPayStatus: 'PAID_MARKED', expiresAt: exp }, NOW), 'paymentMarked')
  assert.equal(performanceChip({ directPayStatus: 'AWAITING_PAYMENT', expiresAt: exp }, NOW + 48 * H + 1), 'expired')
  assert.equal(performanceChip({ directPayStatus: 'AWAITING_PAYMENT', expiresAt: exp }, NOW + 47 * H), 'awaitingPayment')
  assert.equal(performanceChip({ directPayStatus: 'CONFIRMED', expiresAt: exp }, NOW + 100 * H), 'confirmed')
  assert.equal(performanceChip({ directPayStatus: 'EXPIRED' }, NOW), 'expired')
  assert.equal(performanceChip({ directPayStatus: 'CANCELLED' }, NOW), 'cancelled')
})

console.log(`\n${passed} passed`)
