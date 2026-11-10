// S1b-b1 (9 Nov) - self-tests for the W1 holding page decision,
// holdingPageApplies() in src/lib/launch-waves.ts. Regression shape: on
// origin/qa (and on the S1b-a base) the helper does not exist, so this
// fails; on the branch it passes.
//
//   npx tsx scripts/launch-waves-holding.test.ts
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
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

// The wiring moved to src/proxy.ts in S1b-b1-fix (the per-segment
// WaveHoldingGate layouts made every public page dynamic); the matcher /
// held-list equality is checked in scripts/launch-waves-proxy.test.ts.
// Every route inside the (public) group must still be on the held list.
const APP = join(__dirname, '..', 'src', 'app')
test('every (public) route is on the held list', () => {
  const pub = join(APP, '(public)')
  for (const name of readdirSync(pub)) {
    if (!statSync(join(pub, name)).isDirectory()) continue
    assert.equal(isW1HeldPath('/' + name), true, `(public)/${name} is not held`)
  }
})

// S1b-c1 - the holding page is a clean full screen: globals.css hides each
// piece of chrome while [data-afa-launch-holding] is on the page, and every
// hidden selector still exists on its component (a renamed hook would
// silently bring the chrome back).
test('holding page hides top bar, tab bar, nudges and support chat; keeps Sign in', () => {
  const ROOT = join(__dirname, '..')
  const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
  const css = read('src/app/globals.css')
  const hooks: Array<[string, string, string]> = [
    ['[data-afa-top-bar]', 'src/components/mobile/MobileTopBar.tsx', 'data-afa-top-bar'],
    ['[data-afa-tab-bar]', 'src/components/mobile/MobileTabBar.tsx', 'data-afa-tab-bar'],
    ['[data-afa-nudge-stack]', 'src/components/NudgeStack.tsx', 'data-afa-nudge-stack'],
    ['.afa-support-chat-btn', 'src/components/SupportWidget.tsx', 'className="afa-support-chat-btn"'],
    ['.afa-support-chat-panel', 'src/components/SupportWidget.tsx', 'className="afa-support-chat-panel"'],
  ]
  for (const [sel, file, marker] of hooks) {
    assert.ok(css.includes(`body:has([data-afa-launch-holding]) ${sel}`), `globals.css hides ${sel}`)
    assert.ok(read(file).includes(marker), `${file} still carries ${marker}`)
  }
  const holding = read('src/components/LaunchHoldingPage.tsx')
  assert.match(holding, /href="\/login"[\s\S]*data-afa-holding-signin/)
  assert.match(holding, /tr\.nav\.signIn/)
})

console.log(`\n${passed} passed`)
