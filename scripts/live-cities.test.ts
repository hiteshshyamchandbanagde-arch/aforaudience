// Events copy A - the home hero's live city count (Hitesh, 14 Oct).
// Run with tsx:
//
//   npx tsx scripts/live-cities.test.ts
//
// The rule, apart from the DB read: 0 cities -> tag hidden; 1 -> "Live,
// right now in {city}"; 2+ -> "Live, right now — {n} cities and counting"
// with digits in every locale. Only upcoming shows count, and a missing or
// blank city never does.
import assert from 'node:assert/strict'
import { heroLiveTag, liveCityNames } from '../src/lib/live-cities'
import en from '../src/lib/i18n/dictionaries/en'
import bn from '../src/lib/i18n/dictionaries/bn'
import de from '../src/lib/i18n/dictionaries/de'
import es from '../src/lib/i18n/dictionaries/es'
import fr from '../src/lib/i18n/dictionaries/fr'
import gu from '../src/lib/i18n/dictionaries/gu'
import hi from '../src/lib/i18n/dictionaries/hi'
import kn from '../src/lib/i18n/dictionaries/kn'
import ml from '../src/lib/i18n/dictionaries/ml'
import mr from '../src/lib/i18n/dictionaries/mr'
import ta from '../src/lib/i18n/dictionaries/ta'
import te from '../src/lib/i18n/dictionaries/te'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const forms = { many: en.homePage.heroLiveCities, one: en.homePage.heroLiveInCity }

test('0 cities: the tag is hidden', () => {
  assert.equal(heroLiveTag([], forms), null)
})

test('1 city: "Live, right now in {city}"', () => {
  assert.equal(heroLiveTag(['Pune'], forms), 'Live, right now in Pune')
})

test('2+ cities: "Live, right now — {n} cities and counting", digits', () => {
  assert.equal(heroLiveTag(['Pune', 'Mumbai'], forms), 'Live, right now — 2 cities and counting')
  assert.equal(heroLiveTag(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'], forms), 'Live, right now — 12 cities and counting')
})

test('every locale: both forms translated, placeholders kept, digits as digits', () => {
  for (const [code, d] of Object.entries({ bn, de, es, fr, gu, hi, kn, ml, mr, ta, te })) {
    const f = { many: d.homePage.heroLiveCities, one: d.homePage.heroLiveInCity }
    assert.notEqual(f.many, forms.many, `${code} heroLiveCities is the English copy`)
    assert.notEqual(f.one, forms.one, `${code} heroLiveInCity is the English copy`)
    assert.ok(f.many.includes('{n}'), `${code} heroLiveCities keeps {n}`)
    assert.ok(f.one.includes('{city}'), `${code} heroLiveInCity keeps {city}`)
    const many = heroLiveTag(['X', 'Y', 'Z'], f)!
    assert.ok(many.includes('3') && !many.includes('{n}'), `${code}: "${many}" shows 3 as a digit`)
    assert.ok(heroLiveTag(['Pune'], f)!.includes('Pune'), `${code} names the city`)
    assert.equal(heroLiveTag([], f), null)
  }
})

const now = new Date(2026, 9, 16, 12, 0, 0)
const day = (offset: number) => new Date(2026, 9, 16 + offset)

test('liveCityNames: only upcoming shows count', () => {
  assert.deepEqual(
    liveCityNames(
      [
        { date: day(1), startTime: '19:00', venue: { city: 'Pune' } },
        { date: day(-1), startTime: '19:00', venue: { city: 'Mumbai' } },
        { date: day(0), startTime: '11:00', venue: { city: 'Delhi' } }, // started an hour ago
        { date: day(0), startTime: '20:00', venue: { city: 'Nagpur' } }, // tonight
      ],
      now,
    ),
    ['Nagpur', 'Pune'],
  )
})

test('liveCityNames: no city, blank city and no venue never count', () => {
  assert.deepEqual(
    liveCityNames(
      [
        { date: day(1), startTime: '19:00', venue: { city: null } },
        { date: day(1), startTime: '19:00', venue: { city: '   ' } },
        { date: day(1), startTime: '19:00', venue: null },
      ],
      now,
    ),
    [],
  )
})

test('liveCityNames: distinct, trimmed, busiest first then A-Z', () => {
  assert.deepEqual(
    liveCityNames(
      [
        { date: day(1), startTime: '19:00', venue: { city: 'Mumbai' } },
        { date: day(2), startTime: '19:00', venue: { city: 'Pune ' } },
        { date: day(3), startTime: '19:00', venue: { city: 'Pune' } },
        { date: day(3), startTime: '19:00', venue: { city: 'Bengaluru' } },
      ],
      now,
    ),
    ['Pune', 'Bengaluru', 'Mumbai'],
  )
})

console.log(`\n${passed} passed`)
