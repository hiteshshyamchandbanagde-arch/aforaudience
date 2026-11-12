// S1b-c1 (10 Nov) - Hitesh's decision: all payments are direct cash/UPI
// between the parties; AFA never collects. Checks the copy that says so:
// the disclosure lines exist in all 12 dictionaries with their placeholder,
// hi/mr carry no English beyond the allowed brand/acronyms (same allow-list
// as the e2e Latin-leak specs), the three pay screens render them, and the
// launch-wave notes no longer say "Paid" (which read as "pay through AFA").
//
//   npx tsx scripts/direct-pay-disclosure.test.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import en from '../src/lib/i18n/dictionaries/en'
import hi from '../src/lib/i18n/dictionaries/hi'
import mr from '../src/lib/i18n/dictionaries/mr'
import bn from '../src/lib/i18n/dictionaries/bn'
import gu from '../src/lib/i18n/dictionaries/gu'
import kn from '../src/lib/i18n/dictionaries/kn'
import ml from '../src/lib/i18n/dictionaries/ml'
import ta from '../src/lib/i18n/dictionaries/ta'
import te from '../src/lib/i18n/dictionaries/te'
import de from '../src/lib/i18n/dictionaries/de'
import es from '../src/lib/i18n/dictionaries/es'
import fr from '../src/lib/i18n/dictionaries/fr'
import { DIRECT_PAY_FULL_REFUND_MIN_DAYS } from '../src/lib/direct-pay-terms'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const ALL = { en, hi, mr, bn, gu, kn, ml, ta, te, de, es, fr }
const LATIN_ALLOWED = new Set(['AforAudience', 'AFA', 'OTP', 'UPI'])
const latinWords = (s: string) => (s.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !LATIN_ALLOWED.has(w))
const ROOT = join(__dirname, '..')

test('en copy is exactly the agreed wording', () => {
  assert.equal(en.venueDirectPay.payDirectLine, "Pay {name} directly by UPI or cash. AFA doesn't collect this money.")
  assert.equal(en.payAtEntry.payAtVenueLine, "Pay the organiser at the venue. AFA doesn't collect this money.")
  assert.equal(en.launchWaves.paidSlotsSoon, 'Artist slots with a fee open soon')
  assert.equal(en.launchWaves.paidVenueSoonNote, 'Venue bookings with a fee open soon — ₹0 venue bookings are allowed.')
})

test('every dictionary has the lines, {name} kept, AFA named', () => {
  for (const [id, d] of Object.entries(ALL)) {
    assert.ok(d.venueDirectPay.payDirectLine.includes('{name}'), `${id} payDirectLine keeps {name}`)
    assert.ok(d.venueDirectPay.payDirectLine.includes('AFA'), `${id} payDirectLine names AFA`)
    assert.ok(d.payAtEntry.payAtVenueLine.includes('AFA'), `${id} payAtVenueLine names AFA`)
    if (id !== 'en') {
      assert.notEqual(d.venueDirectPay.payDirectLine, en.venueDirectPay.payDirectLine, `${id} translated`)
      assert.notEqual(d.launchWaves.paidSlotsSoon, en.launchWaves.paidSlotsSoon, `${id} translated`)
    }
  }
})

test('hi + mr: no English left in the touched strings', () => {
  for (const d of [hi, mr]) {
    for (const s of [
      d.venueDirectPay.payDirectLine.replace('{name}', ''),
      d.payAtEntry.payAtVenueLine,
      d.launchWaves.paidSlotsSoon,
      d.launchWaves.paidVenueSoonNote,
    ]) assert.deepEqual(latinWords(s), [], s)
  }
})

test('the three pay screens render the disclosure line', () => {
  const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
  assert.match(read('src/components/dashboard/DirectPayBookings.tsx'), /data-afa-direct-pay-disclosure[^\n]*s\.payDirectLine\.replace\('\{name\}'/)
  assert.match(read('src/components/dashboard/PerformanceDirectPay.tsx'), /data-afa-direct-pay-disclosure[^\n]*v\.payDirectLine\.replace\('\{name\}'/)
  assert.match(read('src/app/tickets/page.tsx'), /data-afa-direct-pay-disclosure[^\n]*tr\.payAtEntry\.payAtVenueLine/)
})

// 12 Nov (Hitesh) - the direct-pay 15-day standard term, shown under the
// disclosure line on both direct-pay screens.
test('standard term is 15 days', () => {
  assert.equal(DIRECT_PAY_FULL_REFUND_MIN_DAYS, 15)
})

test('en refundTermLine is the agreed wording', () => {
  assert.equal(
    en.venueDirectPay.refundTermLine,
    'Cancel {days}+ days before the date: full refund of any advance. Inside {days} days: as you both agree.',
  )
})

test('every dictionary has refundTermLine with {days} twice, no hard-coded 15', () => {
  for (const [id, d] of Object.entries(ALL)) {
    const line = d.venueDirectPay.refundTermLine
    assert.equal(line.split('{days}').length - 1, 2, `${id} refundTermLine keeps {days} twice`)
    assert.ok(!/15|१५|౧౫/.test(line), `${id} refundTermLine has no hard-coded 15`)
    if (id !== 'en') assert.notEqual(line, en.venueDirectPay.refundTermLine, `${id} translated`)
  }
})

test('hi + mr: no English in refundTermLine', () => {
  for (const d of [hi, mr]) {
    const s = d.venueDirectPay.refundTermLine.replaceAll('{days}', '')
    assert.deepEqual(latinWords(s), [], s)
  }
})

test('both direct-pay screens render the refund term from the constant', () => {
  const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
  assert.match(read('src/components/dashboard/DirectPayBookings.tsx'), /data-afa-direct-pay-refund-term[^\n]*s\.refundTermLine\.replaceAll\('\{days\}', String\(DIRECT_PAY_FULL_REFUND_MIN_DAYS\)\)/)
  assert.match(read('src/components/dashboard/PerformanceDirectPay.tsx'), /data-afa-direct-pay-refund-term[^\n]*v\.refundTermLine\.replaceAll\('\{days\}', String\(DIRECT_PAY_FULL_REFUND_MIN_DAYS\)\)/)
})

console.log(`\n${passed} passed`)
