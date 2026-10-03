// BUG-2609-071 - self-tests for src/lib/format-date.ts. Same plain
// Node + assert convention as ticket-code.test.ts. Run with tsx:
//
//   npx tsx scripts/format-date.test.ts
//
// Set TZ to anything (TZ=America/New_York, TZ=UTC): the output must not
// change, because every style is pinned to India time.
import assert from 'node:assert/strict'
import { calendarDate, dateLocale, formatDate, istDayKey, istMonthKey } from '../src/lib/format-date'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

// Intl separates the time and the am/pm marker with a narrow no-break
// space in some ICU versions; compare with plain spaces.
const plain = (s: string) => s.replace(/[  ]/g, ' ')

// 4 Oct 2026, 13:45 UTC = 7:15 pm India time, a Sunday.
const EVENING = '2026-10-04T13:45:00.000Z'

test('named styles, default locale', () => {
  assert.equal(formatDate(EVENING, 'short'), '4 Oct')
  assert.equal(formatDate(EVENING, 'medium'), '4 Oct 2026')
  assert.equal(formatDate(EVENING, 'withWeekday'), 'Sun, 4 Oct')
  assert.equal(formatDate(EVENING, 'long'), 'Sunday, 4 October')
  assert.equal(formatDate(EVENING, 'longWithYear'), 'Sunday, 4 October 2026')
  assert.equal(plain(formatDate(EVENING, 'dateTime')), '4 Oct 2026, 7:15 pm')
  assert.equal(plain(formatDate(EVENING, 'time')), '7:15 pm')
  assert.equal(formatDate(EVENING, 'month'), 'Oct')
  assert.equal(formatDate(EVENING, 'monthYearShort'), 'Oct 2026')
  assert.equal(formatDate(EVENING, 'monthYear'), 'October 2026')
})

test('style defaults to medium', () => {
  assert.equal(formatDate(EVENING), '4 Oct 2026')
})

test('never the ambiguous numeric form', () => {
  for (const locale of [undefined, 'en', 'en-US', 'hi', 'de', 'fr', 'es', 'bn', 'ta']) {
    const out = formatDate(EVENING, 'medium', locale)
    assert.ok(!/\d+\/\d+\/\d+/.test(out), `${locale}: ${out}`)
    assert.ok(/2026/.test(out), `${locale}: ${out}`)
  }
})

test('23:30 UTC renders as the next day in India', () => {
  const lateUtc = '2026-10-03T23:30:00.000Z' // 5:00 am on 4 Oct, India time
  assert.equal(formatDate(lateUtc, 'medium'), '4 Oct 2026')
  assert.equal(formatDate(lateUtc, 'withWeekday'), 'Sun, 4 Oct')
  assert.equal(plain(formatDate(lateUtc, 'time')), '5:00 am')
  assert.equal(istDayKey(lateUtc), '2026-10-04')
})

test('a date-only value stored at 00:00 UTC keeps its day', () => {
  assert.equal(formatDate('2026-10-04T00:00:00.000Z', 'medium'), '4 Oct 2026')
  assert.equal(formatDate('2026-10-04', 'medium'), '4 Oct 2026')
})

test('month and year roll over on India time, not UTC', () => {
  assert.equal(formatDate('2026-09-30T18:29:59.000Z', 'monthYear'), 'September 2026')
  assert.equal(formatDate('2026-09-30T18:30:00.000Z', 'monthYear'), 'October 2026')
  assert.equal(istMonthKey('2026-09-30T18:29:59.000Z'), '2026-09')
  assert.equal(istMonthKey('2026-09-30T18:30:00.000Z'), '2026-10')
  assert.equal(istMonthKey('2026-12-31T18:30:00.000Z'), '2027-01')
})

test('accepts Date, ISO string and epoch milliseconds', () => {
  const d = new Date(EVENING)
  assert.equal(formatDate(d, 'medium'), '4 Oct 2026')
  assert.equal(formatDate(d.getTime(), 'medium'), '4 Oct 2026')
})

test('missing or invalid input gives an empty string, never "Invalid Date"', () => {
  assert.equal(formatDate(null), '')
  assert.equal(formatDate(undefined), '')
  assert.equal(formatDate(''), '')
  assert.equal(formatDate('not a date'), '')
})

test('UI locale maps to its Indian variant, others stay as they are', () => {
  assert.equal(dateLocale('en'), 'en-IN-u-nu-latn')
  assert.equal(dateLocale('hi'), 'hi-IN-u-nu-latn')
  assert.equal(dateLocale('bn'), 'bn-IN-u-nu-latn')
  assert.equal(dateLocale('de'), 'de-u-nu-latn')
  assert.equal(dateLocale(undefined), 'en-IN-u-nu-latn')
  assert.equal(dateLocale(null), 'en-IN-u-nu-latn')
})

test('other locales translate the month and keep Latin digits', () => {
  assert.equal(formatDate(EVENING, 'medium', 'de'), '4. Okt. 2026')
  for (const locale of ['hi', 'bn', 'ta', 'gu']) {
    const out = formatDate(EVENING, 'medium', locale)
    assert.ok(/^4 /.test(out) && / 2026$/.test(out), `${locale}: ${out}`)
    assert.ok(!/Oct/.test(out), `${locale}: ${out}`)
  }
})

test('an unknown locale falls back to en-IN instead of throwing', () => {
  assert.equal(formatDate(EVENING, 'medium', 'not_a_locale!'), '4 Oct 2026')
})

test('calendarDate shows the same day in any device zone', () => {
  assert.equal(formatDate(calendarDate(2026, 9), 'monthYear'), 'October 2026')
  assert.equal(formatDate(calendarDate(2026, 9, 31), 'medium'), '31 Oct 2026')
  assert.equal(formatDate(calendarDate(2026, 0, 1), 'medium'), '1 Jan 2026')
  assert.equal(istDayKey(calendarDate(2026, 9, 4)), '2026-10-04')
})

console.log(`\n${passed} passed.`)
