// BUG-2610-003 - self-tests for src/lib/booking-tiers.ts. Run with tsx:
//
//   npx tsx scripts/booking-tiers.test.ts
import assert from 'node:assert/strict'
import { bookingTierNames, listingPrice } from '../src/lib/booking-tiers'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

test('GA booking: the section names with seats, in their order', () => {
  assert.deepEqual(bookingTierNames({ VIP: 2, General: 1 }, []), ['VIP', 'General'])
})

test('GA booking: a section with 0 seats is not a tier of the booking', () => {
  assert.deepEqual(bookingTierNames({ VIP: 0, General: 3 }, []), ['General'])
})

test('numbered booking (seats {}): the booked seats\' tiers, each once', () => {
  const seats = [{ tierLabel: 'General' }, { tierLabel: 'General' }, { tierLabel: 'Front' }]
  assert.deepEqual(bookingTierNames({}, seats), ['General', 'Front'])
})

test('numbered booking with null seats JSON still resolves from its seats', () => {
  assert.deepEqual(bookingTierNames(null, [{ tierLabel: 'General' }]), ['General'])
})

test('no seats of either kind: no tier names', () => {
  assert.deepEqual(bookingTierNames({}, []), [])
})

test('event with its own ticket price keeps it, tiers or not', () => {
  assert.equal(listingPrice(300, [{ price: 250 }]), 300)
})

test('tiered event (ticketPrice null): the cheapest tier', () => {
  assert.equal(listingPrice(null, [{ price: 500 }, { price: 250 }]), 250)
})

test('a ₹0 tier is not a price to show; the cheapest priced tier is', () => {
  assert.equal(listingPrice(null, [{ price: 0 }, { price: 400 }]), 400)
})

test('no price and no priced tiers: nothing to show (card keeps "—")', () => {
  assert.equal(listingPrice(null, []), null)
  assert.equal(listingPrice(0, []), 0)
  assert.equal(listingPrice(undefined, [{ price: 0 }]), null)
})

console.log(`\n${passed} booking-tiers self-tests passed`)
