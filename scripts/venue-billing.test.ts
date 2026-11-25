// BUG-2609-083 - self-tests for src/lib/venue-billing.ts. Same plain
// Node + assert convention as ticket-code.test.ts. Run with tsx:
//
//   npx tsx scripts/venue-billing.test.ts
import assert from 'node:assert/strict'
import {
  billableHours,
  formatDuration,
  hourlyNote,
  hourlyTotal,
  isUnusuallyLong,
  longEventWarning,
  wholeBilledHours,
} from '../src/lib/venue-billing'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

test('11:55 PM -> 2:53 PM is 14 h 58 m overnight, billed as 15 hr', () => {
  const d = billableHours('23:55', '14:53')
  assert.deepEqual(d, { minutes: 898, crossesMidnight: true, billedHours: 15 })
  assert.equal(hourlyTotal(2500, d!.billedHours), 37500)
  assert.equal(hourlyNote(2500, d!), '₹2500/hr × 15 hr (14 h 58 m, billed as 15 hr)')
  assert.equal(longEventWarning(d!), 'This event runs 14 h 58 m and ends the next day. Check AM/PM.')
})

test('7:00 -> 9:05 PM rounds up to 2.5 hr', () => {
  const d = billableHours('19:00', '21:05')
  assert.deepEqual(d, { minutes: 125, crossesMidnight: false, billedHours: 2.5 })
  assert.equal(hourlyTotal(2500, d!.billedHours), 6250)
  assert.equal(hourlyNote(2500, d!), '₹2500/hr × 2.5 hr (2 h 5 m, billed as 2.5 hr)')
  assert.equal(longEventWarning(d!), null)
})

test('exact half-hours and hours are not rounded', () => {
  assert.equal(billableHours('19:00', '21:00')!.billedHours, 2)
  assert.equal(billableHours('19:00', '21:30')!.billedHours, 2.5)
  assert.equal(billableHours('19:00', '21:31')!.billedHours, 3)
  assert.equal(billableHours('19:00', '19:01')!.billedHours, 0.5)
  assert.equal(hourlyNote(2500, billableHours('19:00', '21:00')!), '₹2500/hr × 2 hr')
  assert.equal(hourlyNote(2500, billableHours('19:00', '21:30')!), '₹2500/hr × 2.5 hr')
})

test('minimum-hours floor', () => {
  const d = billableHours('19:00', '20:00', 3)
  assert.deepEqual(d, { minutes: 60, crossesMidnight: false, billedHours: 3 })
  assert.equal(hourlyNote(2500, d!, 3), '₹2500/hr × 3 hr (min 3 hr)')
  // the floor never lowers a longer event
  assert.equal(billableHours('19:00', '23:10', 3)!.billedHours, 4.5)
  assert.equal(hourlyNote(2500, billableHours('19:00', '23:10', 3)!, 3), '₹2500/hr × 4.5 hr (4 h 10 m, billed as 4.5 hr)')
  // null / 0 / undefined minimum is no floor
  assert.equal(billableHours('19:00', '20:00', null)!.billedHours, 1)
  assert.equal(billableHours('19:00', '20:00', 0)!.billedHours, 1)
})

test('equal start and end is a full 24 hours, next day', () => {
  const d = billableHours('20:00', '20:00')
  assert.deepEqual(d, { minutes: 1440, crossesMidnight: true, billedHours: 24 })
  assert.equal(longEventWarning(d!), 'This event runs 24 h and ends the next day. Check AM/PM.')
})

test('a short overnight event still crosses midnight and warns', () => {
  const d = billableHours('23:00', '01:00')!
  assert.deepEqual(d, { minutes: 120, crossesMidnight: true, billedHours: 2 })
  assert.ok(isUnusuallyLong(d))
})

test('over 8 hours on one day warns without the next-day wording', () => {
  const d = billableHours('10:00', '18:30')!
  assert.equal(longEventWarning(d), 'This event runs 8 h 30 m. Check AM/PM.')
  assert.equal(longEventWarning(billableHours('10:00', '18:00')!), null)
})

test('missing or malformed times give null', () => {
  assert.equal(billableHours('', '21:00'), null)
  assert.equal(billableHours('19:00', ''), null)
  assert.equal(billableHours('7pm', '9pm'), null)
  assert.equal(billableHours('25:00', '26:00'), null)
})

test('seconds on a stored time are ignored', () => {
  assert.equal(billableHours('19:00:00', '21:05:00')!.minutes, 125)
})

test('the whole-hour column records a half-hour rounded up', () => {
  assert.equal(wholeBilledHours(2.5), 3)
  assert.equal(wholeBilledHours(15), 15)
})

test('formatDuration', () => {
  assert.equal(formatDuration(898), '14 h 58 m')
  assert.equal(formatDuration(120), '2 h')
  assert.equal(formatDuration(45), '45 m')
})

console.log(`\n${passed} passed.`)
