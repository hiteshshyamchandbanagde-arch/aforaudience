// BUG-2610-018 - self-tests for src/lib/unfinished-checkout.ts. Same plain
// Node + assert convention as format-date.test.ts. Run with tsx:
//
//   npx tsx scripts/unfinished-checkout.test.ts
import assert from 'node:assert/strict'
import { isExpiredHold, splitUnfinishedCheckouts, UNFINISHED_CHECKOUT_WINDOW_MS } from '../src/lib/unfinished-checkout'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const NOW = new Date('2026-10-09T12:00:00.000Z')
const HOUR = 60 * 60 * 1000
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString()

type B = { id: string; status: string; expiresAt: string | null; event: { id: string } }
const b = (id: string, status: string, expiresAt: string | null, eventId: string): B => ({ id, status, expiresAt, event: { id: eventId } })
const ids = (list: B[]) => list.map((x) => x.id)

test('expired hold: PENDING with expiresAt in the past only', () => {
  assert.equal(isExpiredHold(b('a', 'PENDING', at(-1), 'e'), NOW), true)
  assert.equal(isExpiredHold(b('a', 'PENDING', at(HOUR), 'e'), NOW), false)
  assert.equal(isExpiredHold(b('a', 'PENDING', null, 'e'), NOW), false)
  assert.equal(isExpiredHold(b('a', 'CONFIRMED', at(-HOUR), 'e'), NOW), false)
  assert.equal(isExpiredHold(b('a', 'CANCELLED', at(-HOUR), 'e'), NOW), false)
})

test('Atul case: confirmed + expired hold on one event shows only the confirmed card', () => {
  const { tickets, unfinished } = splitUnfinishedCheckouts([b('conf', 'CONFIRMED', null, 'jaipur'), b('hold', 'PENDING', at(-HOUR), 'jaipur')], NOW)
  assert.deepEqual(ids(tickets), ['conf'])
  assert.deepEqual(ids(unfinished), [])
})

test('expired hold under 24 h with no confirmed booking: one compact row, no card', () => {
  const { tickets, unfinished } = splitUnfinishedCheckouts([b('hold', 'PENDING', at(-HOUR), 'e1')], NOW)
  assert.deepEqual(ids(tickets), [])
  assert.deepEqual(ids(unfinished), ['hold'])
})

test('24 h boundary: exactly 24 h is still shown, a millisecond later is hidden', () => {
  assert.deepEqual(ids(splitUnfinishedCheckouts([b('h', 'PENDING', at(-UNFINISHED_CHECKOUT_WINDOW_MS), 'e')], NOW).unfinished), ['h'])
  assert.deepEqual(ids(splitUnfinishedCheckouts([b('h', 'PENDING', at(-UNFINISHED_CHECKOUT_WINDOW_MS - 1), 'e')], NOW).unfinished), [])
})

test('older holds are hidden and never become cards', () => {
  const { tickets, unfinished } = splitUnfinishedCheckouts([b('old', 'PENDING', at(-9 * 24 * HOUR), 'e')], NOW)
  assert.deepEqual(ids(tickets), [])
  assert.deepEqual(ids(unfinished), [])
})

test('several expired holds on one event: at most one row, the latest', () => {
  const { unfinished } = splitUnfinishedCheckouts([b('h1', 'PENDING', at(-5 * HOUR), 'e'), b('h2', 'PENDING', at(-HOUR), 'e'), b('h3', 'PENDING', at(-3 * HOUR), 'e')], NOW)
  assert.deepEqual(ids(unfinished), ['h2'])
})

test('a live hold keeps its card and suppresses the row for that event', () => {
  const { tickets, unfinished } = splitUnfinishedCheckouts([b('live', 'PENDING', at(10 * 60 * 1000), 'e'), b('dead', 'PENDING', at(-HOUR), 'e')], NOW)
  assert.deepEqual(ids(tickets), ['live'])
  assert.deepEqual(ids(unfinished), [])
})

test('a cancelled booking does not suppress the row; it keeps its own card', () => {
  const { tickets, unfinished } = splitUnfinishedCheckouts([b('c', 'CANCELLED', null, 'e'), b('h', 'PENDING', at(-HOUR), 'e')], NOW)
  assert.deepEqual(ids(tickets), ['c'])
  assert.deepEqual(ids(unfinished), ['h'])
})

test('rows across events: newest expiry first; other bookings untouched and in order', () => {
  const list = [b('t1', 'CONFIRMED', null, 'x'), b('a', 'PENDING', at(-6 * HOUR), 'e1'), b('r', 'REFUNDED', null, 'y'), b('c', 'PENDING', at(-2 * HOUR), 'e2')]
  const { tickets, unfinished } = splitUnfinishedCheckouts(list, NOW)
  assert.deepEqual(ids(tickets), ['t1', 'r'])
  assert.deepEqual(ids(unfinished), ['c', 'a'])
})

console.log(`\n${passed} passed`)
