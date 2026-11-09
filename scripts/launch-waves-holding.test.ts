// S1b-b1 (9 Nov) - self-tests for the W1 holding page decision,
// holdingPageApplies() in src/lib/launch-waves.ts. Regression shape: on
// origin/qa (and on the S1b-a base) the helper does not exist, so this
// fails; on the branch it passes.
//
//   npx tsx scripts/launch-waves-holding.test.ts
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { W1_HELD_PREFIXES, holdingPageApplies, isW1HeldPath, normalisePathname } from '../src/lib/launch-waves'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const HELD = [
  '/',
  '/events',
  '/events/',
  '/events/abc123',
  '/events/abc123/',
  '/artists',
  '/artists/some-artist',
  '/organisers',
  '/organisers/org1',
  '/tours/summer-tour',
  '/venue-owners',
  '/venue-owners/v1',
  '/wall-of-fame',
  '/venues',
  '/venues/venue-1',
  '/blog',
  '/livestreams',
  '/for-artists',
  '/careers',
  '/events?city=pune',
  '/?ref=x',
]

const ALWAYS_REACHABLE = [
  '/login',
  '/login/',
  '/forgot-password',
  '/reset-password',
  '/reset-password/',
  '/verify-email',
  '/terms',
  '/privacy',
  '/refund-policy',
  '/contact',
  '/about',
  '/dashboard',
  '/dashboard/admin/settings',
  '/dashboard/admin/settings/',
  '/api/platform-settings/launch-waves',
  '/api/auth/session',
  '/sw.js',
  '/manifest.webmanifest',
  '/offline.html',
  '/icon-192x192.png',
  '/favicon.ico',
  '/.well-known/assetlinks.json',
  '/_next/static/chunks/main.js',
  '/register',
]

// Look-alike prefixes must not be caught by a held prefix.
const LOOK_ALIKES = ['/eventsx', '/venues-guide', '/blogger', '/careers-old', '/artistsfoo']

test('normalisePathname strips query, hash and trailing slashes', () => {
  assert.equal(normalisePathname('/events/'), '/events')
  assert.equal(normalisePathname('/events?x=1'), '/events')
  assert.equal(normalisePathname('/events#top'), '/events')
  assert.equal(normalisePathname(''), '/')
  assert.equal(normalisePathname('/'), '/')
  assert.equal(normalisePathname('//'), '/')
})

test('W1 closed, non-admin: every discovery route is held', () => {
  for (const p of HELD) assert.equal(holdingPageApplies(p, false, false), true, p)
})

test('W1 closed, non-admin: always-reachable routes are never held', () => {
  for (const p of ALWAYS_REACHABLE) assert.equal(holdingPageApplies(p, false, false), false, p)
})

test('W1 closed: look-alike paths are not held', () => {
  for (const p of LOOK_ALIKES) assert.equal(holdingPageApplies(p, false, false), false, p)
})

test('W1 closed, ADMIN: nothing is held', () => {
  for (const p of [...HELD, ...ALWAYS_REACHABLE]) assert.equal(holdingPageApplies(p, false, true), false, p)
})

test('W1 open: nothing is held, admin or not', () => {
  for (const p of [...HELD, ...ALWAYS_REACHABLE]) {
    assert.equal(holdingPageApplies(p, true, false), false, p)
    assert.equal(holdingPageApplies(p, true, true), false, p)
  }
})

test('every held prefix is itself a held path, and the list has no "/" catch-all', () => {
  for (const prefix of W1_HELD_PREFIXES) assert.equal(isW1HeldPath(prefix), true, prefix)
  assert.equal((W1_HELD_PREFIXES as readonly string[]).includes('/'), false)
})

// The wiring: every held prefix's folder (top-level and/or inside the
// (public) route group) has a layout.tsx that runs WaveHoldingGate with that
// same path, and every route inside (public) is on the held list. A new
// discovery route added without a gate fails here.
const APP = join(__dirname, '..', 'src', 'app')
test('every held prefix folder has a WaveHoldingGate layout with its own path', () => {
  for (const prefix of W1_HELD_PREFIXES) {
    const name = prefix.slice(1)
    const dirs = [join(APP, name), join(APP, '(public)', name)].filter((d) => existsSync(d))
    assert.ok(dirs.length > 0, `no folder for ${prefix}`)
    for (const d of dirs) {
      const layout = join(d, 'layout.tsx')
      assert.ok(existsSync(layout), `missing ${layout}`)
      assert.ok(readFileSync(layout, 'utf8').includes(`<WaveHoldingGate path="${prefix}">`), `${layout} does not gate ${prefix}`)
    }
  }
})

test('every (public) route is on the held list', () => {
  const pub = join(APP, '(public)')
  for (const name of readdirSync(pub)) {
    if (!statSync(join(pub, name)).isDirectory()) continue
    assert.equal(isW1HeldPath('/' + name), true, `(public)/${name} is not held`)
  }
})

test('the homepage is gated', () => {
  assert.ok(readFileSync(join(APP, 'page.tsx'), 'utf8').includes('<WaveHoldingGate path="/">'))
})

console.log(`\n${passed} passed`)
