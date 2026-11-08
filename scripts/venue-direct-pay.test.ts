// D2 (Hitesh, 8 Nov) - self-tests for the direct-payment venue booking
// state machine in src/lib/venue-direct-pay.ts. Regression shape: on
// origin/qa this module does not exist (accept goes straight to CONFIRMED
// with a ₹199 platform fee), so this fails; on the branch it passes.
//
//   npx tsx scripts/venue-direct-pay.test.ts
import assert from 'node:assert/strict'
import {
  DIRECT_PAY_EXPIRY_HOURS,
  DIRECT_PAY_PLATFORM_FEE,
  PAYER_REFERENCE_MAX,
  directPayExpiresAt,
  directPayNote,
  directPayTransition,
  isDirectPayExpired,
  normalisePayerReference,
  parseUpiId,
  parseUpiQrUrl,
  shouldUseDirectPay,
  venueBookingChip,
} from '../src/lib/venue-direct-pay'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const H = 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 8, 12, 0, 0)

// --- when is a booking direct ---
test('switch OFF -> direct', () => assert.equal(shouldUseDirectPay(false), true))
test('switch ON, nothing requested -> online path unchanged', () => assert.equal(shouldUseDirectPay(true), false))
test('switch ON, owner chose DIRECT -> direct', () => assert.equal(shouldUseDirectPay(true, 'DIRECT'), true))
test('switch ON, junk requested -> online', () => assert.equal(shouldUseDirectPay(true, 'CASH'), false))

// --- fee ---
test('no AFA platform fee on direct bookings', () => assert.equal(DIRECT_PAY_PLATFORM_FEE, 0))

// --- expiry at 48 h ---
test('expiresAt is exactly 48 h out', () => {
  assert.equal(DIRECT_PAY_EXPIRY_HOURS, 48)
  assert.equal(directPayExpiresAt(NOW).getTime(), NOW + 48 * H)
})
test('not expired at exactly 48 h, expired 1 ms later', () => {
  const b = { directPayStatus: 'AWAITING_PAYMENT', expiresAt: new Date(NOW + 48 * H) }
  assert.equal(isDirectPayExpired(b, NOW + 48 * H), false)
  assert.equal(isDirectPayExpired(b, NOW + 48 * H + 1), true)
})
test('PAID_MARKED also expires', () => {
  assert.equal(isDirectPayExpired({ directPayStatus: 'PAID_MARKED', expiresAt: new Date(NOW) }, NOW + 1), true)
})
test('CONFIRMED / CANCELLED / null never expire', () => {
  for (const s of ['CONFIRMED', 'CANCELLED', 'EXPIRED', null]) {
    assert.equal(isDirectPayExpired({ directPayStatus: s, expiresAt: new Date(NOW) }, NOW + 99 * H), false)
  }
})
test('missing expiresAt never expires', () => {
  assert.equal(isDirectPayExpired({ directPayStatus: 'AWAITING_PAYMENT', expiresAt: null }, NOW), false)
})

// --- transitions + who may act ---
test('organiser marks paid from AWAITING_PAYMENT', () => {
  assert.deepEqual(directPayTransition('AWAITING_PAYMENT', 'markPaid', 'ORGANISER'), { ok: true, next: 'PAID_MARKED' })
})
test('venue owner cannot mark paid', () => {
  const r = directPayTransition('AWAITING_PAYMENT', 'markPaid', 'VENUE_OWNER')
  assert.equal(r.ok, false)
  assert.equal(!r.ok && r.status, 403)
})
test('marking paid twice is refused', () => {
  const r = directPayTransition('PAID_MARKED', 'markPaid', 'ORGANISER')
  assert.equal(r.ok, false)
  assert.equal(!r.ok && r.status, 400)
})
test('owner confirms receipt from PAID_MARKED', () => {
  assert.deepEqual(directPayTransition('PAID_MARKED', 'confirmReceived', 'VENUE_OWNER'), { ok: true, next: 'CONFIRMED' })
})
test('owner may confirm cash received before the organiser taps', () => {
  assert.deepEqual(directPayTransition('AWAITING_PAYMENT', 'confirmReceived', 'VENUE_OWNER'), { ok: true, next: 'CONFIRMED' })
})
test('organiser cannot confirm receipt', () => {
  const r = directPayTransition('PAID_MARKED', 'confirmReceived', 'ORGANISER')
  assert.equal(!r.ok && r.status, 403)
})
test('either side may cancel while waiting', () => {
  for (const s of ['AWAITING_PAYMENT', 'PAID_MARKED']) {
    for (const side of ['ORGANISER', 'VENUE_OWNER'] as const) {
      assert.deepEqual(directPayTransition(s, 'cancel', side), { ok: true, next: 'CANCELLED' })
    }
  }
})
test('nothing moves once confirmed, cancelled, expired or not direct', () => {
  for (const s of ['CONFIRMED', 'CANCELLED', 'EXPIRED', null, undefined]) {
    for (const a of ['markPaid', 'confirmReceived', 'cancel'] as const) {
      const r = directPayTransition(s, a, a === 'markPaid' ? 'ORGANISER' : 'VENUE_OWNER')
      assert.equal(r.ok, false, `${s} ${a}`)
    }
  }
})

// --- inputs ---
test('payer reference trimmed, capped, empty -> null', () => {
  assert.equal(normalisePayerReference('  UTR123  '), 'UTR123')
  assert.equal(normalisePayerReference(''), null)
  assert.equal(normalisePayerReference(42), null)
  assert.equal(normalisePayerReference('x'.repeat(500))?.length, PAYER_REFERENCE_MAX)
})
test('UPI ID validation', () => {
  assert.deepEqual(parseUpiId(' vinayak.hall@okicici '), { ok: true, value: 'vinayak.hall@okicici' })
  assert.deepEqual(parseUpiId(''), { ok: true, value: null })
  assert.deepEqual(parseUpiId(null), { ok: true, value: null })
  assert.equal(parseUpiId('no-at-sign').ok, false)
  assert.equal(parseUpiId('a@b').ok, false)
  assert.equal(parseUpiId('name@bank space').ok, false)
})
test('UPI QR URL validation (D2b)', () => {
  assert.deepEqual(parseUpiQrUrl(' https://x.public.blob.vercel-storage.com/avatars/qr.png '), { ok: true, value: 'https://x.public.blob.vercel-storage.com/avatars/qr.png' })
  assert.deepEqual(parseUpiQrUrl(''), { ok: true, value: null })
  assert.deepEqual(parseUpiQrUrl(null), { ok: true, value: null })
  assert.equal(parseUpiQrUrl('http://example.com/qr.png').ok, false)
  assert.equal(parseUpiQrUrl('javascript:alert(1)').ok, false)
  assert.equal(parseUpiQrUrl('data:image/png;base64,AAAA').ok, false)
  assert.equal(parseUpiQrUrl('not a url').ok, false)
  assert.equal(parseUpiQrUrl(42).ok, false)
  assert.equal(parseUpiQrUrl('https://x.com/' + 'a'.repeat(3000)).ok, false)
})
test('payee note names the payee and says AFA does not collect', () => {
  assert.equal(directPayNote('Vinayak Hall'), 'Pay Vinayak Hall directly. AforAudience does not collect or hold this payment.')
})

// --- status chips ---
test('chips', () => {
  assert.equal(venueBookingChip({ status: 'PENDING' }), 'requested')
  assert.equal(venueBookingChip({ status: 'CONFIRMED' }), 'confirmed')
  assert.equal(venueBookingChip({ status: 'CANCELLED' }), 'declined')
  const exp = new Date(NOW + H)
  assert.equal(venueBookingChip({ status: 'PENDING', directPayStatus: 'AWAITING_PAYMENT', expiresAt: exp }, NOW), 'awaitingPayment')
  assert.equal(venueBookingChip({ status: 'PENDING', directPayStatus: 'PAID_MARKED', expiresAt: exp }, NOW), 'paymentMarked')
  assert.equal(venueBookingChip({ status: 'PENDING', directPayStatus: 'AWAITING_PAYMENT', expiresAt: exp }, NOW + 2 * H), 'expired')
  assert.equal(venueBookingChip({ status: 'CONFIRMED', directPayStatus: 'CONFIRMED' }), 'confirmed')
  assert.equal(venueBookingChip({ status: 'CANCELLED', directPayStatus: 'EXPIRED' }), 'expired')
  assert.equal(venueBookingChip({ status: 'CANCELLED', directPayStatus: 'CANCELLED' }), 'cancelled')
})

console.log(`\n${passed} passed`)
