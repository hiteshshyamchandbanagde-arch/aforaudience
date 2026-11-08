// S1a (Hitesh, 8 Nov) - self-tests for the "paid bookings" master switch
// in src/lib/paid-bookings.ts. Regression shape: on origin/qa there is no
// guard (this module does not exist), so these fail; on the branch they pass.
//
//   npx tsx scripts/paid-bookings.test.ts
import assert from 'node:assert/strict'
import {
  PAID_BOOKINGS_DISABLED,
  PaidBookingsDisabledError,
  assertPaidAllowed,
  isPaidBookingsEnabled,
  paidBookingBlock,
} from '../src/lib/paid-bookings'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

test('[S1a] flag reads true only when the setting is exactly true', () => {
  assert.equal(isPaidBookingsEnabled({ paidBookingsEnabled: true }), true)
  assert.equal(isPaidBookingsEnabled({ paidBookingsEnabled: false }), false)
  assert.equal(isPaidBookingsEnabled(null), false)
  assert.equal(isPaidBookingsEnabled(undefined), false)
})

test('[S1a] OFF + paid amount: 403 with the stable PAID_BOOKINGS_DISABLED code', () => {
  const r = paidBookingBlock(29900, false)
  assert.ok(r)
  assert.equal(r.status, 403)
  assert.equal(r.body.code, PAID_BOOKINGS_DISABLED)
  assert.equal(PAID_BOOKINGS_DISABLED, 'PAID_BOOKINGS_DISABLED')
})

test('[S1a] OFF + smallest paid amount (1 paisa) is still blocked', () => {
  assert.ok(paidBookingBlock(1, false))
})

test('[S1a] OFF + free total (0) is never blocked', () => {
  assert.equal(paidBookingBlock(0, false), null)
  assert.doesNotThrow(() => assertPaidAllowed(0, false))
})

test('[S1a] OFF + nonsense amounts are treated as free (caller validates them)', () => {
  assert.equal(paidBookingBlock(-100, false), null)
  assert.equal(paidBookingBlock(Number.NaN, false), null)
})

test('[S1a] ON: paid and free both go through', () => {
  assert.equal(paidBookingBlock(29900, true), null)
  assert.equal(paidBookingBlock(0, true), null)
  assert.doesNotThrow(() => assertPaidAllowed(29900, true))
})

test('[S1a] choke-point assert throws a typed error when OFF', () => {
  assert.throws(
    () => assertPaidAllowed(100, false),
    (e: unknown) => e instanceof PaidBookingsDisabledError && e.code === PAID_BOOKINGS_DISABLED
  )
})

console.log(`\n${passed} passed`)
