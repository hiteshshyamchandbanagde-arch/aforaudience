// BUG-2610-022 - self-tests for src/lib/application-status.ts and
// src/lib/rating-stars.ts. Same plain Node + assert convention as
// format-date.test.ts. Run with tsx (any TZ gives the same result):
//
//   npx tsx scripts/application-status.test.ts
import assert from 'node:assert/strict'
import {
  countOpenPendingApplications,
  displayApplicationStatus,
  eventStartsAt,
  isPastEvent,
  splitApplicationsByEventDate,
} from '../src/lib/application-status'
import { starParts } from '../src/lib/rating-stars'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

// 9 Oct 2026, 12:00 India time.
const NOW = new Date('2026-10-09T06:30:00.000Z')
// QA seeds store an event's day at 01:45 UTC (7:15 am India time).
const day = (d: string) => `${d}T01:45:03.403Z`

test('event start is the India-time day of Event.date plus startTime', () => {
  assert.equal(eventStartsAt({ date: day('2026-09-20'), startTime: '19:00' }).toISOString(), '2026-09-20T13:30:00.000Z')
  // Midnight India time is the previous day in UTC: still the 5th in India.
  assert.equal(eventStartsAt({ date: '2026-12-04T18:30:00.000Z', startTime: '9:30' }).toISOString(), '2026-12-05T04:00:00.000Z')
  // No start time: the end of that day.
  assert.equal(eventStartsAt({ date: day('2026-10-09') }).toISOString(), '2026-10-09T18:29:00.000Z')
})

test('past means the event has started', () => {
  assert.equal(isPastEvent({ date: day('2026-09-20'), startTime: '19:00' }, NOW), true)
  assert.equal(isPastEvent({ date: day('2026-10-09'), startTime: '11:59' }, NOW), true)
  assert.equal(isPastEvent({ date: day('2026-10-09'), startTime: '12:00' }, NOW), true)
  assert.equal(isPastEvent({ date: day('2026-10-09'), startTime: '12:01' }, NOW), false)
  assert.equal(isPastEvent({ date: day('2026-12-05'), startTime: '19:00' }, NOW), false)
})

test('Hrithik on One-Act Play Festival (20 Sep, PENDING) shows Closed; decided ones keep their status', () => {
  const past = { date: day('2026-09-20'), startTime: '19:00' }
  const ahead = { date: day('2026-12-05'), startTime: '19:00' }
  assert.equal(displayApplicationStatus('PENDING', past, NOW), 'CLOSED')
  assert.equal(displayApplicationStatus('WAITLISTED', past, NOW), 'CLOSED')
  assert.equal(displayApplicationStatus('APPROVED', past, NOW), 'APPROVED')
  assert.equal(displayApplicationStatus('REJECTED', past, NOW), 'REJECTED')
  assert.equal(displayApplicationStatus('PENDING', ahead, NOW), 'PENDING')
  assert.equal(displayApplicationStatus('WAITLISTED', ahead, NOW), 'WAITLISTED')
})

test("Omkar's badge: a past-event PENDING application is not counted", () => {
  const apps = [
    { status: 'PENDING', event: { date: day('2026-09-20'), startTime: '19:00' } },
    { status: 'PENDING', event: { date: day('2026-12-05'), startTime: '19:00' } },
    { status: 'APPROVED', event: { date: day('2026-12-05'), startTime: '19:00' } },
    { status: 'WAITLISTED', event: { date: day('2026-12-05'), startTime: '19:00' } },
  ]
  assert.equal(countOpenPendingApplications(apps, NOW), 1)
  assert.equal(countOpenPendingApplications(apps.slice(0, 1), NOW), 0)
})

test('order: upcoming soonest first, then past most recent first', () => {
  // Hitesh's 7 Oct order: 4 Oct, 5 Dec, 20 Sep, 13 Sep, 8 Sep, 6 Sep (4 Oct already past on 9 Oct).
  const apps = ['2026-10-04', '2026-12-05', '2026-09-20', '2026-09-13', '2026-09-08', '2026-09-06', '2026-11-01'].map((d) => ({ id: d, event: { title: `Event ${d}`, date: day(d), startTime: '19:00' } }))
  const { upcoming, past } = splitApplicationsByEventDate(apps, NOW)
  assert.deepEqual(upcoming.map((a) => a.id), ['2026-11-01', '2026-12-05'])
  assert.deepEqual(past.map((a) => a.id), ['2026-10-04', '2026-09-20', '2026-09-13', '2026-09-08', '2026-09-06'])
})

test('order: two events starting at the same time keep a fixed order (title, then id), whatever the input order', () => {
  // QA, 9 Oct: Mixed Bag Comedy Lineup and Improv Theatre Jam both start
  // 5 Dec 19:00 India time; their stored dates differ by 81 ms, which is
  // not an event start. The list used to follow the API's order for them.
  const mixed = { id: 'qa-demo-app-full-hrithik-5', event: { title: 'Mixed Bag Comedy Lineup', date: '2026-12-05T01:45:03.422Z', startTime: '19:00' } }
  const improv = { id: 'e2e-bug-2610-022-open-app', event: { title: 'Improv Theatre Jam', date: '2026-12-05T01:45:03.503Z', startTime: '19:00' } }
  const sameTitleA = { id: 'a', event: { title: 'Same', date: day('2026-12-06'), startTime: '19:00' } }
  const sameTitleB = { id: 'b', event: { title: 'Same', date: day('2026-12-06'), startTime: '19:00' } }
  for (const input of [[mixed, improv, sameTitleB, sameTitleA], [sameTitleA, improv, sameTitleB, mixed]]) {
    assert.deepEqual(splitApplicationsByEventDate(input, NOW).upcoming.map((a) => a.id), [improv.id, mixed.id, 'a', 'b'])
  }
  const pastMixed = { ...mixed, event: { ...mixed.event, date: '2026-09-05T01:45:03.422Z' } }
  const pastImprov = { ...improv, event: { ...improv.event, date: '2026-09-05T01:45:03.503Z' } }
  assert.deepEqual(splitApplicationsByEventDate([pastMixed, pastImprov], NOW).past.map((a) => a.id), [improv.id, mixed.id])
})

test('stars: 4.5 is four and a half, not five', () => {
  assert.deepEqual(starParts(4.5), { full: 4, half: true })
  assert.deepEqual(starParts(5), { full: 5, half: false })
  assert.deepEqual(starParts(4), { full: 4, half: false })
  assert.deepEqual(starParts(4.2), { full: 4, half: false })
  assert.deepEqual(starParts(4.3), { full: 4, half: true })
  assert.deepEqual(starParts(4.75), { full: 5, half: false })
  assert.deepEqual(starParts(0), { full: 0, half: false })
  assert.deepEqual(starParts(7), { full: 5, half: false })
})

console.log(`\n${passed} passed`)
