// e2e hardening (12 Nov) - self-tests for the QA launch-wave pre-flight
// message, e2e/helpers/launch-waves-preflight.ts, which e2e/global-setup.ts
// throws before any spec runs. Regression shape: on origin/qa the helper does
// not exist, so this fails; on test/e2e-hardening it passes. Never touches
// the QA waves.
//
//   npx tsx scripts/e2e-preflight.test.ts
import assert from 'node:assert/strict'
import { closedWaves, launchWavesPreflightMessage } from '../e2e/helpers/launch-waves-preflight'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const ALL_OPEN = { W1: true, W2: true, W3: true, W4: true }

test('all four open: no message', () => {
  assert.equal(launchWavesPreflightMessage(ALL_OPEN), null)
  assert.deepEqual(closedWaves(ALL_OPEN), [])
})

test('W1 off (the 11 Nov case): the message names W1 and its column, and how to fix it', () => {
  assert.equal(
    launchWavesPreflightMessage({ ...ALL_OPEN, W1: false }),
    'QA pre-flight: launch wave W1 (waveDiscoveryOpen) is OFF on QA. The suite expects all four waves open. ' +
      'Turn it back on in Admin → Settings → Launch waves, then re-run.'
  )
})

test('each wave alone off is named, and only it', () => {
  const fields: Record<string, string> = {
    W1: 'waveDiscoveryOpen',
    W2: 'waveOnboardingOpen',
    W3: 'waveTicketsOpen',
    W4: 'waveDirectBookingsOpen',
  }
  for (const [key, field] of Object.entries(fields)) {
    const msg = launchWavesPreflightMessage({ ...ALL_OPEN, [key]: false })
    assert.ok(msg, `${key} off gives a message`)
    assert.ok(msg!.includes(`launch wave ${key} (${field}) is OFF`), msg!)
    for (const other of Object.keys(fields).filter((k) => k !== key)) {
      assert.ok(!msg!.includes(`${other} (`), `${key} off does not name ${other}: ${msg}`)
    }
  }
})

test('two off: both named in one message, plural wording', () => {
  const msg = launchWavesPreflightMessage({ ...ALL_OPEN, W2: false, W4: false })
  assert.equal(
    msg,
    'QA pre-flight: launch waves W2 (waveOnboardingOpen), W4 (waveDirectBookingsOpen) are OFF on QA. ' +
      'The suite expects all four waves open. Turn them back on in Admin → Settings → Launch waves, then re-run.'
  )
})

test('missing or non-boolean values count as closed (fail safe)', () => {
  assert.deepEqual(closedWaves({ W1: true, W2: 'true', W3: 1 }), [
    'W2 (waveOnboardingOpen)',
    'W3 (waveTicketsOpen)',
    'W4 (waveDirectBookingsOpen)',
  ])
  assert.equal(closedWaves(null).length, 4)
  assert.equal(closedWaves('oops').length, 4)
  assert.equal(closedWaves({}).length, 4)
})

console.log(`\n${passed} passed`)
