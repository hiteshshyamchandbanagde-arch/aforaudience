// BUG-2610-016 - self-tests for the admin Revenue chart's axis labels
// (src/lib/timeline-label.ts). Run with tsx:
//
//   npx tsx scripts/timeline-label.test.ts
import assert from 'node:assert/strict'
import { timelineLabels } from '../src/lib/timeline-label'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

test('[BUG-2610-016] monthly buckets read "Sep", "Oct", not "09", "10"', () => {
  assert.deepEqual(timelineLabels(['2026-09', '2026-10']), ['Sep', 'Oct'])
})

test('[BUG-2610-016] the year is added only when the range spans years', () => {
  assert.deepEqual(timelineLabels(['2025-12', '2026-01']), ['Dec 2025', 'Jan 2026'])
})

test('daily and weekly buckets read day-first', () => {
  assert.deepEqual(timelineLabels(['2026-09-30', '2026-10-01']), ['30 Sep', '1 Oct'])
  assert.deepEqual(timelineLabels(['2025-12-29', '2026-01-05']), ['29 Dec 2025', '5 Jan 2026'])
})

test('a single bucket and an empty list', () => {
  assert.deepEqual(timelineLabels(['2026-10']), ['Oct'])
  assert.deepEqual(timelineLabels([]), [])
})

console.log(`\n${passed} passed.`)
