// BUG-2610-001 follow-up - isOfflineFailure tells "no signal" from a
// server error. Run with tsx (from the repo root):
//
//   npx tsx scripts/network-error.test.ts
import assert from 'node:assert/strict'
import { isOfflineFailure } from '../src/lib/network-error'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

test('device offline: always an offline failure, whatever the error', () => {
  assert.equal(isOfflineFailure(new Error('Could not send code.'), false), true)
  assert.equal(isOfflineFailure(undefined, false), true)
})

test('online, fetch rejected with no response (TypeError): offline failure', () => {
  assert.equal(isOfflineFailure(new TypeError('Failed to fetch'), true), true)
})

test('online, an HTTP or parse error is not an offline failure', () => {
  assert.equal(isOfflineFailure(new Error('Too many requests'), true), false)
  assert.equal(isOfflineFailure(new SyntaxError('Unexpected token <'), true), false)
  assert.equal(isOfflineFailure(null, true), false)
})

test('no navigator (server): only a TypeError counts', () => {
  assert.equal(isOfflineFailure(new TypeError('fetch failed')), true)
  assert.equal(isOfflineFailure(new Error('x')), false)
})

console.log(`\n${passed} passed`)
