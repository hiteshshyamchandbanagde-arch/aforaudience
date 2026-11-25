// BUG-2609-087 - self-tests for the by-event-date range helpers in
// src/lib/sales-range.ts (India-time calendar periods). Run with tsx:
//
//   npx tsx scripts/sales-range.test.ts
import assert from 'node:assert/strict'
import { eventDateBucketKey, getCalendarRangeBounds, getPreviousCalendarRangeBounds } from '../src/lib/sales-range'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const iso = (b: { start: Date; end: Date } | null) => (b ? [b.start.toISOString(), b.end.toISOString()] : null)

// Saturday 3 Oct 2026, 10:00 India time.
const NOW = new Date('2026-10-03T04:30:00.000Z')
// The QA booking in the bug: event date 1 Oct (stored 00:00 UTC), made 30 Sep.
const BOOKING_FROM = new Date('2026-10-01T00:00:00.000Z')
const inside = (b: { start: Date; end: Date } | null, d: Date) => !!b && d >= b.start && d < b.end

test('month is the whole India-time calendar month', () => {
  assert.deepEqual(iso(getCalendarRangeBounds('month', NOW)), ['2026-09-30T18:30:00.000Z', '2026-10-31T18:30:00.000Z'])
})

test('week is Monday to Monday, India time', () => {
  assert.deepEqual(iso(getCalendarRangeBounds('week', NOW)), ['2026-09-27T18:30:00.000Z', '2026-10-04T18:30:00.000Z'])
  // a Sunday belongs to the week that started the Monday before
  const sunday = new Date('2026-10-04T10:00:00.000Z')
  assert.deepEqual(iso(getCalendarRangeBounds('week', sunday)), ['2026-09-27T18:30:00.000Z', '2026-10-04T18:30:00.000Z'])
})

test('quarter and year', () => {
  assert.deepEqual(iso(getCalendarRangeBounds('quarter', NOW)), ['2026-09-30T18:30:00.000Z', '2026-12-31T18:30:00.000Z'])
  assert.deepEqual(iso(getCalendarRangeBounds('year', NOW)), ['2025-12-31T18:30:00.000Z', '2026-12-31T18:30:00.000Z'])
})

test('all has no bounds', () => {
  assert.equal(getCalendarRangeBounds('all', NOW), null)
  assert.equal(getPreviousCalendarRangeBounds('all', NOW), null)
})

test('the 1 Oct booking made on 30 Sep is in this week, month, quarter and year', () => {
  for (const range of ['week', 'month', 'quarter', 'year'] as const) {
    assert.ok(inside(getCalendarRangeBounds(range, NOW), BOOKING_FROM), range)
  }
})

test('an event later this month counts; one next month does not', () => {
  const month = getCalendarRangeBounds('month', NOW)
  assert.ok(inside(month, new Date('2026-10-25T00:00:00.000Z')))
  assert.ok(!inside(month, new Date('2026-11-01T00:00:00.000Z')))
  assert.ok(!inside(month, new Date('2026-09-30T00:00:00.000Z')))
})

test('the month is India time: 00:10 on the 1st in India is already the new month', () => {
  const justAfterMidnightIst = new Date('2026-10-31T18:40:00.000Z') // 1 Nov, 00:10 India
  assert.deepEqual(iso(getCalendarRangeBounds('month', justAfterMidnightIst)), ['2026-10-31T18:30:00.000Z', '2026-11-30T18:30:00.000Z'])
})

test('previous period is the whole calendar period before', () => {
  assert.deepEqual(iso(getPreviousCalendarRangeBounds('month', NOW)), ['2026-08-31T18:30:00.000Z', '2026-09-30T18:30:00.000Z'])
  assert.deepEqual(iso(getPreviousCalendarRangeBounds('week', NOW)), ['2026-09-20T18:30:00.000Z', '2026-09-27T18:30:00.000Z'])
  assert.deepEqual(iso(getPreviousCalendarRangeBounds('quarter', NOW)), ['2026-06-30T18:30:00.000Z', '2026-09-30T18:30:00.000Z'])
  assert.deepEqual(iso(getPreviousCalendarRangeBounds('year', NOW)), ['2024-12-31T18:30:00.000Z', '2025-12-31T18:30:00.000Z'])
})

test('January: the previous month is December of the year before', () => {
  const jan = new Date('2027-01-15T06:00:00.000Z')
  assert.deepEqual(iso(getPreviousCalendarRangeBounds('month', jan)), ['2026-11-30T18:30:00.000Z', '2026-12-31T18:30:00.000Z'])
})

test('bucket keys are India-time days and months', () => {
  assert.equal(eventDateBucketKey('month', BOOKING_FROM), '2026-10-01')
  assert.equal(eventDateBucketKey('week', BOOKING_FROM), '2026-10-01')
  assert.equal(eventDateBucketKey('year', BOOKING_FROM), '2026-10')
  assert.equal(eventDateBucketKey('all', BOOKING_FROM), '2026-10')
  // Thursday 1 Oct -> the Monday of that week
  assert.equal(eventDateBucketKey('quarter', BOOKING_FROM), '2026-09-28')
  // 19:00 UTC on 30 Sep is 00:30 on 1 Oct in India
  assert.equal(eventDateBucketKey('month', new Date('2026-09-30T19:00:00.000Z')), '2026-10-01')
  assert.equal(eventDateBucketKey('year', new Date('2026-09-30T19:00:00.000Z')), '2026-10')
})

console.log(`\n${passed} passed.`)
