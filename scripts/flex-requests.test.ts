// BUG-2609-073 - self-tests for src/lib/flex-requests.ts. Run with tsx:
//
//   npx tsx scripts/flex-requests.test.ts
import assert from 'node:assert/strict'
import { isFlexRequestExpired, isFlexRequestWaitingOn } from '../src/lib/flex-requests'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const NOW = Date.parse('2026-10-07T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000)
const offer = (proposedBy: string, h = 1) => ({ proposedBy, createdAt: hoursAgo(h) })

test('the Organiser made the last offer: waiting on the venue, not the Organiser', () => {
  const r = { status: 'PENDING', offers: [offer('ORGANISER')] }
  assert.equal(isFlexRequestWaitingOn(r, 'VENUE_OWNER', NOW), true)
  assert.equal(isFlexRequestWaitingOn(r, 'ORGANISER', NOW), false)
})

test('the venue countered last: waiting on the Organiser, not the venue', () => {
  const r = { status: 'PENDING', offers: [offer('ORGANISER', 3), offer('VENUE_OWNER')] }
  assert.equal(isFlexRequestWaitingOn(r, 'ORGANISER', NOW), true)
  assert.equal(isFlexRequestWaitingOn(r, 'VENUE_OWNER', NOW), false)
})

test('declined, accepted or expired requests wait on nobody', () => {
  for (const status of ['DECLINED', 'ACCEPTED', 'EXPIRED']) {
    const r = { status, offers: [offer('ORGANISER')] }
    assert.equal(isFlexRequestWaitingOn(r, 'VENUE_OWNER', NOW), false, status)
    assert.equal(isFlexRequestWaitingOn(r, 'ORGANISER', NOW), false, status)
  }
})

test('a PENDING request past the 48-hour window waits on nobody', () => {
  const r = { status: 'PENDING', offers: [offer('ORGANISER', 49)] }
  assert.equal(isFlexRequestExpired(r, NOW), true)
  assert.equal(isFlexRequestWaitingOn(r, 'VENUE_OWNER', NOW), false)
})

test('47 hours after the last offer it is still waiting', () => {
  const r = { status: 'PENDING', offers: [offer('ORGANISER', 47)] }
  assert.equal(isFlexRequestExpired(r, NOW), false)
  assert.equal(isFlexRequestWaitingOn(r, 'VENUE_OWNER', NOW), true)
})

test('no offer yet: the Organiser just sent it, so it waits on the venue', () => {
  const r = { status: 'PENDING', offers: [] }
  assert.equal(isFlexRequestExpired(r, NOW), false)
  assert.equal(isFlexRequestWaitingOn(r, 'VENUE_OWNER', NOW), true)
  assert.equal(isFlexRequestWaitingOn(r, 'ORGANISER', NOW), false)
})

test('createdAt as an ISO string (JSON) reads the same as a Date', () => {
  const r = { status: 'PENDING', offers: [{ proposedBy: 'VENUE_OWNER', createdAt: hoursAgo(2).toISOString() }] }
  assert.equal(isFlexRequestWaitingOn(r, 'ORGANISER', NOW), true)
})

console.log(`\n${passed} flex-requests self-tests passed`)
