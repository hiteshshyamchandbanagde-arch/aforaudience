// S1b-a (Hitesh, 9 Nov) - self-tests for the launch wave switches W1-W4 in
// src/lib/launch-waves.ts. Regression shape: on origin/qa this module does
// not exist (no wave gates), so this fails; on the branch it passes.
//
//   npx tsx scripts/launch-waves.test.ts
import assert from 'node:assert/strict'
import {
  WAVES,
  WAVE_CLOSED,
  WAVE_FLAG,
  WaveClosedError,
  isAdminRole,
  isWaveOpen,
  launchWaveHint,
  performanceNeedsW4,
  venueBookingNeedsW4,
  waveBlock,
  type LaunchWaveFlags,
} from '../src/lib/launch-waves'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const ALL_OFF: LaunchWaveFlags = {
  waveDiscoveryOpen: false,
  waveOnboardingOpen: false,
  waveTicketsOpen: false,
  waveDirectBookingsOpen: false,
}
const ALL_ON: LaunchWaveFlags = {
  waveDiscoveryOpen: true,
  waveOnboardingOpen: true,
  waveTicketsOpen: true,
  waveDirectBookingsOpen: true,
}

test('flag-key map matches the PlatformSettings columns', () => {
  assert.deepEqual(WAVE_FLAG, {
    W1: 'waveDiscoveryOpen',
    W2: 'waveOnboardingOpen',
    W3: 'waveTicketsOpen',
    W4: 'waveDirectBookingsOpen',
  })
  assert.deepEqual([...WAVES], ['W1', 'W2', 'W3', 'W4'])
})

for (const wave of WAVES) {
  test(`${wave} open only when its own flag is exactly true`, () => {
    assert.equal(isWaveOpen(ALL_ON, wave), true)
    assert.equal(isWaveOpen(ALL_OFF, wave), false)
    assert.equal(isWaveOpen({ ...ALL_OFF, [WAVE_FLAG[wave]]: true }, wave), true)
    assert.equal(isWaveOpen({ ...ALL_ON, [WAVE_FLAG[wave]]: false }, wave), false)
    assert.equal(isWaveOpen(null, wave), false)
    assert.equal(isWaveOpen(undefined, wave), false)
    assert.equal(isWaveOpen({}, wave), false)
  })

  test(`${wave} closed + non-admin: 403 WAVE_CLOSED naming the wave`, () => {
    const r = waveBlock(wave, false, false)
    assert.ok(r)
    assert.equal(r.status, 403)
    assert.equal(r.body.code, WAVE_CLOSED)
    assert.equal(r.body.wave, wave)
    assert.ok(r.body.error.length > 10)
  })

  test(`${wave} closed + admin: bypass`, () => {
    assert.equal(waveBlock(wave, false, true), null)
  })

  test(`${wave} open: never blocked`, () => {
    assert.equal(waveBlock(wave, true, false), null)
    assert.equal(waveBlock(wave, true, true), null)
  })

  test(`${wave} WaveClosedError carries code + wave`, () => {
    const e = new WaveClosedError(wave)
    assert.equal(e.code, 'WAVE_CLOSED')
    assert.equal(e.wave, wave)
    assert.ok(e instanceof Error)
  })
}

test('each wave has its own message', () => {
  const msgs = new Set(WAVES.map((w) => waveBlock(w, false, false)!.body.error))
  assert.equal(msgs.size, 4)
})

test('read hint: four booleans, only-true counts as open', () => {
  assert.deepEqual(launchWaveHint(ALL_ON), { W1: true, W2: true, W3: true, W4: true })
  assert.deepEqual(launchWaveHint(ALL_OFF), { W1: false, W2: false, W3: false, W4: false })
  assert.deepEqual(launchWaveHint(null), { W1: false, W2: false, W3: false, W4: false })
  assert.deepEqual(
    launchWaveHint({ ...ALL_OFF, waveTicketsOpen: true }),
    { W1: false, W2: false, W3: true, W4: false }
  )
})

test('admin role check is exact', () => {
  assert.equal(isAdminRole('ADMIN'), true)
  for (const r of ['ORGANISER', 'AUDIENCE', 'ARTIST', 'VENUE_OWNER', 'admin', undefined, null]) {
    assert.equal(isAdminRole(r), false)
  }
})

test('W4 venue booking: amount > 0 needs W4, 0 / junk does not', () => {
  assert.equal(venueBookingNeedsW4(1), true)
  assert.equal(venueBookingNeedsW4(500000), true)
  assert.equal(venueBookingNeedsW4('2500'), true)
  assert.equal(venueBookingNeedsW4(0), false)
  assert.equal(venueBookingNeedsW4(-5), false)
  assert.equal(venueBookingNeedsW4(undefined), false)
  assert.equal(venueBookingNeedsW4(null), false)
  assert.equal(venueBookingNeedsW4('abc'), false)
})

test('W4 performance: PAID / BUY_IN need W4, FREE does not', () => {
  assert.equal(performanceNeedsW4('PAID'), true)
  assert.equal(performanceNeedsW4('BUY_IN'), true)
  assert.equal(performanceNeedsW4('FREE'), false)
  assert.equal(performanceNeedsW4(undefined), false)
  assert.equal(performanceNeedsW4('paid'), false)
})

console.log(`\n${passed} passed`)
