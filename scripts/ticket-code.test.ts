// BUG-2609-053 - self-tests for src/lib/ticket-code.ts. Same plain
// Node + assert convention as check-design-tokens.test.js (no test
// framework in this repo). Run with tsx, which the seed scripts already use:
//
//   npx tsx scripts/ticket-code.test.ts
import assert from 'node:assert/strict'
import { generateTicketCode, normalizeTicketCode, TICKET_CODE_ALPHABET, TICKET_CODE_RE } from '../src/lib/ticket-code'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

test('alphabet has no look-alike characters', () => {
  for (const c of '01OILU') assert.ok(!TICKET_CODE_ALPHABET.includes(c), c)
  assert.equal(new Set(TICKET_CODE_ALPHABET).size, TICKET_CODE_ALPHABET.length)
})

test('generated codes match AFA-XXXX-XXXX', () => {
  for (let i = 0; i < 2000; i++) assert.match(generateTicketCode(), TICKET_CODE_RE)
})

test('generated codes are not repeating in a small sample', () => {
  const seen = new Set<string>()
  for (let i = 0; i < 5000; i++) seen.add(generateTicketCode())
  assert.equal(seen.size, 5000)
})

test('normalize accepts case, spacing, missing dashes and missing prefix', () => {
  for (const input of ['AFA-7K3M-Q9TX', 'afa-7k3m-q9tx', ' AFA 7K3M Q9TX ', 'AFA7K3MQ9TX', '7K3M-Q9TX', '7k3mq9tx']) {
    assert.equal(normalizeTicketCode(input), 'AFA-7K3M-Q9TX', input)
  }
})

test('normalize rejects booking ids and codes with excluded characters', () => {
  for (const input of ['cmfz1k2ab0000xyz123abcde', 'AFA-7K3M-Q9T0', 'AFA-7K3M-Q9TO', 'AFA-7K3M', '', 'AFA-7K3M-Q9TXX']) {
    assert.equal(normalizeTicketCode(input), null, input)
  }
})

console.log(`\n${passed} passed`)
