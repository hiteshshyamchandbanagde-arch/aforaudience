// BUG-2609-084 - self-tests for src/components/mobile/tabBarRoutes.ts,
// the one source for which mobile bottom bar a route gets. Run with tsx:
//
//   npx tsx scripts/tab-bar-routes.test.ts
//
// The second test reads the repo: every page that renders
// <DashboardShell> must be mapped, so DashboardShell's own older bar
// never shows on mobile. A new shell page added without a mapping fails
// here.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { deriveBarState, unifiedTabBarShows } from '../src/components/mobile/tabBarRoutes'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

test('organiser event pages keep the organiser bar, My Events active', () => {
  for (const p of [
    '/dashboard/organiser/events/abc123',
    '/dashboard/organiser/events/abc123/',
    '/dashboard/organiser/events/abc123/edit',
    '/dashboard/organiser/events/abc123/lineup',
    '/dashboard/organiser/events/abc123/checkin',
    '/dashboard/organiser/events/abc123/sales/',
  ]) {
    assert.deepEqual(deriveBarState(p, 'ORGANISER'), { kind: 'role', role: 'ORGANISER', active: 'my-events' }, p)
  }
})

test('the exact create route still wins over the event prefix', () => {
  assert.deepEqual(deriveBarState('/dashboard/organiser/events/create/', 'ORGANISER'), { kind: 'role', role: 'ORGANISER', active: 'create' })
})

test('tour detail and tour create keep the organiser bar, Tours active', () => {
  for (const p of ['/dashboard/organiser/tours/t1', '/dashboard/organiser/tours/create/']) {
    assert.deepEqual(deriveBarState(p, 'ORGANISER'), { kind: 'role', role: 'ORGANISER', active: 'tours' }, p)
  }
})

test('a venue’s pages keep the venue-owner bar, My Venues active', () => {
  for (const p of ['/dashboard/venue/v1', '/dashboard/venue/v1/edit', '/dashboard/venue/v1/seat-map/', '/dashboard/venue/v1/sales']) {
    assert.deepEqual(deriveBarState(p, 'VENUE_OWNER'), { kind: 'role', role: 'VENUE_OWNER', active: 'my-venues' }, p)
  }
})

test('exact venue routes still win over the venue prefix', () => {
  assert.equal((deriveBarState('/dashboard/venue/bookings/', 'VENUE_OWNER') as { active: string }).active, 'bookings')
  assert.equal((deriveBarState('/dashboard/venue/sales', 'VENUE_OWNER') as { active: string }).active, 'sales')
  assert.equal((deriveBarState('/dashboard/venue/create', 'VENUE_OWNER') as { active: string }).active, 'register-venue')
  assert.equal((deriveBarState('/dashboard/venue/edit', 'VENUE_OWNER') as { active: string }).active, 'account-settings')
})

test('the shared requests page follows the role, and never falls back to no bar', () => {
  assert.deepEqual(deriveBarState('/dashboard/venue-requests', 'ORGANISER'), { kind: 'role', role: 'ORGANISER', active: 'requests' })
  assert.deepEqual(deriveBarState('/dashboard/venue-requests', 'VENUE_OWNER'), { kind: 'role', role: 'VENUE_OWNER', active: 'requests' })
  assert.deepEqual(deriveBarState('/dashboard/venue-requests', 'ARTIST'), { kind: 'primary', active: null })
})

test('pushed public pages and a message thread still have no bar', () => {
  for (const p of ['/events/e1', '/events/e1/seats', '/checkout/b1', '/venues/v1', '/artists/a1', '/dashboard/messages/m1', '/login']) {
    assert.equal(unifiedTabBarShows(p, 'AUDIENCE'), false, p)
  }
})

test('every page that renders <DashboardShell> is mapped', () => {
  const pages = execFileSync('git', ['grep', '-l', '<DashboardShell', '--', 'src/app'], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\/page\.tsx$/.test(f))
  assert.ok(pages.length >= 30, `expected at least 30 shell pages, found ${pages.length}`)
  const unmapped: string[] = []
  for (const file of pages) {
    const route = '/' + file.replace(/^src\/app\//, '').replace(/\/?page\.tsx$/, '').replace(/\[[^\]]+\]/g, 'x1')
    // session role only matters on the shared requests page; any role maps
    if (!unifiedTabBarShows(route, undefined)) unmapped.push(route)
    assert.ok(readFileSync(file, 'utf8').includes('DashboardShell'))
  }
  assert.deepEqual(unmapped, [], `shell pages with no bar mapping: ${unmapped.join(', ')}`)
})

if (process.argv.includes('--table')) {
  const pages = execFileSync('git', ['grep', '-l', '<DashboardShell', '--', 'src/app'], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\/page\.tsx$/.test(f))
    .sort()
  console.log('\nroute | bar | active')
  for (const file of pages) {
    const route = '/' + file.replace(/^src\/app\//, '').replace(/\/?page\.tsx$/, '')
    const s = deriveBarState(route.replace(/\[[^\]]+\]/g, 'x1'), route.includes('venue-requests') ? 'ORGANISER' : undefined)
    const bar = s.kind === 'role' ? s.role : s.kind
    const active = 'active' in s ? s.active ?? '(none)' : '-'
    console.log(`${route} | ${bar} | ${active}`)
  }
}

console.log(`\n${passed} passed.`)
