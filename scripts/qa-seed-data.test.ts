// Run F (16 Oct 2026) - self-tests for the QA seed's data builders
// (scripts/qa-seed-data.ts). No database. Run with tsx:
//
//   npx tsx scripts/qa-seed-data.test.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildSeedBooking,
  DEMO_EVENT_DESCRIPTIONS,
  GENERAL_EVENT_DESCRIPTIONS,
  generalEventDescription,
  PLACEHOLDER_TEXT,
} from './qa-seed-data'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const NOW = new Date('2026-09-10T01:45:04.751Z') // the run that seeded atul-1 wrong
const DAY = 24 * 60 * 60 * 1000
const at = (dayOffset: number) => new Date(NOW.getTime() + dayOffset * DAY)

// Every booking the seed builds: Atul's 4 (same offsets/prices as
// seedDemoPersonas), the golden checked-in booking, and general-event
// bookings (past/upcoming, free/paid).
const cases = [
  { id: 'qa-demo-booking-full-atul-1', dayOffset: -4, ticketPrice: null, isPast: true },
  { id: 'qa-demo-booking-full-atul-2', dayOffset: -2, ticketPrice: 300, isPast: true },
  { id: 'qa-demo-booking-full-atul-3', dayOffset: 3, ticketPrice: 200, isPast: false },
  { id: 'qa-demo-booking-full-atul-4', dayOffset: 17, ticketPrice: 250, isPast: false },
  { id: 'qa-golden-event-01-booking-checkedin', dayOffset: -14, ticketPrice: 400, isPast: true },
  { id: 'qa-general-event-07-booking-1', dayOffset: -10, ticketPrice: null, isPast: true },
  { id: 'qa-general-event-08-booking-1', dayOffset: -25, ticketPrice: 212, isPast: true },
  { id: 'qa-general-event-01-booking-1', dayOffset: 7, ticketPrice: null, isPast: false },
  { id: 'qa-general-event-02-booking-1', dayOffset: 1, ticketPrice: 254, isPast: false },
]
const built = cases.map((c) => ({
  c,
  booking: buildSeedBooking({
    id: c.id,
    userId: 'u',
    eventId: 'e',
    eventDate: at(c.dayOffset),
    ticketPrice: c.ticketPrice,
    isPast: c.isPast,
    checkedInByUserId: 'organiser',
    now: NOW,
  }),
}))

test('every seeded booking has non-empty seats in the GA shape { General: qty }', () => {
  for (const { c, booking } of built) {
    assert.deepEqual(booking.seats, { General: 1 }, c.id)
  }
})

test('free event booking (atul-1) still has a seat, with ₹0 amounts', () => {
  const atul1 = built[0].booking
  assert.deepEqual(atul1.seats, { General: 1 })
  assert.equal(atul1.totalAmount, 0)
  assert.equal(atul1.subtotalAmount, 0)
})

test('paid booking amounts follow the ticket price', () => {
  const atul2 = built[1].booking
  assert.equal(atul2.subtotalAmount, 300)
  assert.equal(atul2.totalAmount, 300)
  assert.equal(atul2.bookingFeeAmount, 0)
})

test('checked-in bookings: createdAt < checkedInAt <= event date', () => {
  for (const { c, booking } of built.filter((b) => b.c.isPast)) {
    assert.ok(booking.checkedInAt, c.id)
    assert.ok(booking.createdAt.getTime() < booking.checkedInAt!.getTime(), c.id)
    assert.ok(booking.checkedInAt!.getTime() <= at(c.dayOffset).getTime(), c.id)
    assert.equal(booking.checkedInByUserId, 'organiser', c.id)
  }
})

test('every booking: createdAt before the event and never after the seed ran', () => {
  for (const { c, booking } of built) {
    assert.ok(booking.createdAt.getTime() < at(c.dayOffset).getTime(), c.id)
    assert.ok(booking.createdAt.getTime() <= NOW.getTime(), c.id)
  }
})

test('upcoming bookings are not checked in', () => {
  for (const { c, booking } of built.filter((b) => !b.c.isPast)) {
    assert.equal(booking.checkedInAt, null, c.id)
    assert.equal(booking.checkedInByUserId, null, c.id)
  }
})

test('all 10 demo events have a description, none placeholder', () => {
  for (let i = 1; i <= 10; i++) {
    const d = DEMO_EVENT_DESCRIPTIONS[`qa-demo-event-full-${i}`]
    assert.ok(d && d.length > 40, `qa-demo-event-full-${i}`)
    assert.doesNotMatch(d, PLACEHOLDER_TEXT)
  }
})

test('general event descriptions exist for every EventType the seed picks, none placeholder', () => {
  for (const type of ['OPEN_MIC', 'STAND_UP', 'POETRY', 'THEATER', 'LINEUP']) {
    for (let i = 0; i < 10; i++) {
      const d = generalEventDescription(type, i)
      assert.ok(d.length > 40, `${type} #${i}`)
      assert.doesNotMatch(d, PLACEHOLDER_TEXT)
    }
  }
  for (const pool of Object.values(GENERAL_EVENT_DESCRIPTIONS)) {
    for (const d of pool) assert.doesNotMatch(d, PLACEHOLDER_TEXT)
  }
})

test('placeholder regex catches the QA rows chat found', () => {
  assert.match('Defungo theca degusto sub cinis uter ipsum.', PLACEHOLDER_TEXT)
  assert.match('Dolorem ut colo. Lorem', PLACEHOLDER_TEXT)
})

test('qa-seed.ts builds bookings and descriptions only through these builders', () => {
  const src = readFileSync(new URL('./qa-seed.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /description:\s*faker\.lorem/)
  assert.doesNotMatch(src, /\bseats:\s*[^\n]*\{\s*\}/)
  assert.doesNotMatch(src, /\bseats:\s*\{\s*General/)
  assert.equal((src.match(/buildSeedBooking\(/g) || []).length, 3)
})

console.log(`\n${passed} passed`)
