// Self-tests for e2e/ci-summary.mjs's ticket lines (docs/testing-rules.md
// T5: a ticket closes when its tests pass). Runs the script on small
// Playwright JSON reports and reads the annotations it prints:
//
//   node scripts/ci-summary.test.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const dir = mkdtempSync(path.join(tmpdir(), 'ci-summary-'))
let passed = 0
function test(name, fn) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

function summary(report) {
  const file = path.join(dir, `r${passed}.json`)
  writeFileSync(file, JSON.stringify(report))
  const env = { ...process.env, GITHUB_STEP_SUMMARY: '' }
  return execFileSync('node', ['e2e/ci-summary.mjs', file], { encoding: 'utf8', env }).trim().split('\n')
}

const spec = (title, ...statuses) => ({ title, tests: statuses.map((status) => ({ status })) })

test('a ticket passes only when every test carrying it passed', () => {
  const out = summary({
    stats: { expected: 3, unexpected: 1 },
    suites: [
      { title: 'a.spec.ts', specs: [spec('[BUG-2609-077] at 390', 'expected'), spec('[BUG-2609-077] at 1440', 'unexpected')] },
      { title: 'b.spec.ts', specs: [spec('[GEN-2609-013] [BUG-2609-082] two ids', 'expected', 'expected')] },
    ],
  })
  assert.ok(out.includes('::notice title=e2e::TICKETS PASSED: BUG-2609-082, GEN-2609-013'), out.join('\n'))
  assert.ok(out.includes('::error title=e2e::TICKETS FAILED: BUG-2609-077'), out.join('\n'))
})

test('ids on a describe block count for the tests inside it; flaky counts as passed', () => {
  const out = summary({
    stats: { expected: 1, flaky: 1 },
    suites: [{ title: 'c.spec.ts', specs: [], suites: [{ title: '[BUG-2609-071] dates', specs: [spec('day-first', 'expected'), spec('India time', 'flaky')] }] }],
  })
  assert.ok(out.includes('::notice title=e2e::TICKETS PASSED: BUG-2609-071'), out.join('\n'))
  assert.ok(out.includes('::notice title=e2e::TICKETS FAILED: none'), out.join('\n'))
})

test('a ticket whose tests were all skipped is neither passed nor failed', () => {
  const out = summary({ stats: { skipped: 1 }, suites: [{ title: 'd.spec.ts', specs: [spec('[FEAT-2608-047] tour', 'skipped')] }] })
  assert.ok(out.includes('::notice title=e2e::TICKETS PASSED: none'), out.join('\n'))
  assert.ok(out.includes('::notice title=e2e::TICKETS NOT RUN (skipped or left out): FEAT-2608-047'), out.join('\n'))
})

test('unbracketed ids and titles without ids add no ticket lines', () => {
  const out = summary({ stats: { expected: 1 }, suites: [{ title: 'e.spec.ts', specs: [spec('BUG-2609-077 no brackets', 'expected')] }] })
  assert.equal(out.length, 1, out.join('\n'))
  assert.match(out[0], /1 passed, 0 failed/)
})

console.log(`\n${passed} passed`)
