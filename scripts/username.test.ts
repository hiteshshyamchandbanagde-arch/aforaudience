// BUG-2609-054 - self-tests for the shared username rule in
// src/lib/validation.ts. Plain Node + assert, run with:
//
//   npx tsx scripts/username.test.ts
import assert from 'node:assert/strict'
import { isValidUsernameFormat } from '../src/lib/validation'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

test('accepts 3-20 letters, digits and underscores', () => {
  for (const u of ['abc', 'valid_name', 'A1_b2', 'x'.repeat(20), '___']) assert.ok(isValidUsernameFormat(u), u)
})

test('rejects the BUG-2609-054 cases', () => {
  for (const u of ['foo@bar.com', 'ab', 'a'.repeat(21)]) assert.equal(isValidUsernameFormat(u), false, u)
})

test('rejects spaces, dots, dashes, non-ASCII and empty', () => {
  for (const u of ['has space', 'first.last', 'dash-name', 'नाम_abc', 'café_1', '', ' abc']) assert.equal(isValidUsernameFormat(u), false, u)
})

test('non-strings are rejected rather than throwing', () => {
  assert.equal(isValidUsernameFormat(undefined as unknown as string), false)
  assert.equal(isValidUsernameFormat(42 as unknown as string), false)
})

console.log(`\n${passed} passed`)
