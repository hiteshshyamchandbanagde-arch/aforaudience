// BUG-2609-086 - self-tests for the Seat Map Builder's draft-restore rule
// and age wording (src/lib/seatmap-draft.ts). Run with tsx:
//
//   npx tsx scripts/seatmap-draft.test.ts
import assert from 'node:assert/strict'
import { draftDecision, humaniseAge } from '../src/lib/seatmap-draft'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const NOW = Date.parse('2026-10-07T06:00:00.000Z')
const ctx = { now: NOW, frozen: false, serverSavedAt: null }

test('[BUG-2609-086] the 29 Sep case: a 14998-minute-old draft is discarded, not offered', () => {
  assert.equal(draftDecision({ savedAt: NOW - 14998 * MIN, seatCount: 44 }, ctx), 'discard')
})

test('[BUG-2609-086] a frozen map never offers a draft, however fresh', () => {
  assert.equal(draftDecision({ savedAt: NOW - MIN, seatCount: 44 }, { ...ctx, frozen: true }), 'discard')
})

test('a fresh draft (an accidental refresh) is offered', () => {
  assert.equal(draftDecision({ savedAt: NOW - 5 * MIN, seatCount: 3 }, ctx), 'offer')
})

test('exactly 24 h is still offered; a minute more is not', () => {
  assert.equal(draftDecision({ savedAt: NOW - DAY, seatCount: 3 }, ctx), 'offer')
  assert.equal(draftDecision({ savedAt: NOW - DAY - MIN, seatCount: 3 }, ctx), 'discard')
})

test('a draft older than the server copy is superseded; a newer one is offered', () => {
  assert.equal(draftDecision({ savedAt: NOW - 2 * HOUR, seatCount: 3 }, { ...ctx, serverSavedAt: NOW - HOUR }), 'discard')
  assert.equal(draftDecision({ savedAt: NOW - HOUR, seatCount: 3 }, { ...ctx, serverSavedAt: NOW - 2 * HOUR }), 'offer')
})

test('an empty or malformed draft is discarded', () => {
  assert.equal(draftDecision({ savedAt: NOW - MIN, seatCount: 0 }, ctx), 'discard')
  assert.equal(draftDecision({ savedAt: NaN, seatCount: 3 }, ctx), 'discard')
})

test('[BUG-2609-086] ages read as people say them', () => {
  assert.equal(humaniseAge(14998 * MIN), '10 days ago')
  assert.equal(humaniseAge(20 * 1000), 'just now')
  assert.equal(humaniseAge(MIN), '1 minute ago')
  assert.equal(humaniseAge(59 * MIN), '59 minutes ago')
  assert.equal(humaniseAge(HOUR), '1 hour ago')
  assert.equal(humaniseAge(23 * HOUR + 59 * MIN), '23 hours ago')
  assert.equal(humaniseAge(DAY), '1 day ago')
  assert.equal(humaniseAge(-5), 'just now')
})

console.log(`\n${passed} passed.`)
