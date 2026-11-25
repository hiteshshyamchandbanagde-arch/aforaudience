// BUG-2610-001 - self-tests for src/lib/offline-tickets.ts (the offline
// My Tickets snapshot) and its clearing in src/lib/sw-cache.ts. Plain
// Node + assert, same convention as ticket-code.test.ts:
//
//   npx tsx scripts/offline-tickets.test.ts
import assert from 'node:assert/strict'
import {
  OFFLINE_TICKETS_KEY,
  clearOfflineTickets,
  readOfflineTickets,
  saveOfflineTickets,
  toOfflineTickets,
  type SnapshotSourceBooking,
} from '../src/lib/offline-tickets'

let passed = 0
async function test(name: string, fn: () => void | Promise<void>) {
  await fn()
  passed++
  console.log(`ok - ${name}`)
}

class MemoryStorage {
  data = new Map<string, string>()
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null }
  setItem(k: string, v: string) { this.data.set(k, String(v)) }
  removeItem(k: string) { this.data.delete(k) }
  clear() { this.data.clear() }
}

const throwing = {
  getItem(): string | null { throw new Error('SecurityError') },
  setItem() { throw new Error('QuotaExceededError') },
  removeItem() { throw new Error('SecurityError') },
}

const NOW = new Date(2026, 9, 10, 12, 0) // 10 Oct 2026 12:00 local

function booking(over: Partial<SnapshotSourceBooking> & { date?: string; startTime?: string } = {}): SnapshotSourceBooking {
  const { date = '2026-10-20T00:00:00.000Z', startTime = '19:30', ...rest } = over
  return {
    id: 'bk_1',
    status: 'CONFIRMED',
    seats: { VIP: 2, General: 1 },
    tierNames: ['VIP', 'General'],
    ticketCode: 'AFA-ABCD-EFGH',
    checkedInAt: null,
    event: { id: 'ev_1', title: 'Jazz Night', date, startTime, type: 'CONCERT', venue: { name: 'Blue Frog', city: 'Mumbai' } },
    ...rest,
    // Fields the snapshot must never copy.
    ...({ totalAmount: 1500, bookingFeeAmount: 50, razorpayPaymentId: 'pay_x' } as object),
  } as SnapshotSourceBooking
}

async function main() {
  await test('keeps upcoming confirmed tickets with what the door needs', () => {
    const [t, ...rest] = toOfflineTickets([booking()], NOW)
    assert.equal(rest.length, 0)
    assert.equal(t.id, 'bk_1')
    assert.equal(t.ticketCode, 'AFA-ABCD-EFGH')
    assert.deepEqual(t.tierNames, ['VIP', 'General'])
    assert.equal(t.qty, 3)
    assert.deepEqual(t.event.venue, { name: 'Blue Frog', city: 'Mumbai' })
    assert.equal(t.event.title, 'Jazz Night')
  })

  await test('no payment or amount fields in the snapshot', () => {
    const s = new MemoryStorage()
    saveOfflineTickets('u1', [booking()], NOW, s)
    const raw = s.getItem(OFFLINE_TICKETS_KEY)!
    for (const k of ['totalAmount', 'bookingFeeAmount', 'razorpay', 'pay_x', '1500']) assert.ok(!raw.includes(k), k)
  })

  await test('drops cancelled, refunded, pending and past tickets', () => {
    const list = [
      booking({ id: 'c', status: 'CANCELLED' }),
      booking({ id: 'r', status: 'REFUNDED' }),
      booking({ id: 'p', status: 'PENDING' }),
      booking({ id: 'old', date: '2026-10-01T00:00:00.000Z' }),
      booking({ id: 'ok' }),
    ]
    assert.deepEqual(toOfflineTickets(list, NOW).map((t) => t.id), ['ok'])
  })

  await test('a show that started a few hours ago is still kept (late arrival at the door)', () => {
    const started = booking({ id: 'now', date: '2026-10-10T00:00:00.000Z', startTime: '09:00' })
    assert.deepEqual(toOfflineTickets([started], NOW).map((t) => t.id), ['now'])
  })

  await test('qty counts numbered seats when the booking has seat labels', () => {
    const [t] = toOfflineTickets([booking({ seatLabels: ['A1', 'A2'], seats: { Stalls: 2 }, tierNames: undefined })], NOW)
    assert.equal(t.qty, 2)
    assert.deepEqual(t.tierNames, ['Stalls'])
  })

  await test('save then read returns the same user snapshot with savedAt', () => {
    const s = new MemoryStorage()
    saveOfflineTickets('u1', [booking()], NOW, s)
    const snap = readOfflineTickets('u1', NOW, s)
    assert.ok(snap)
    assert.equal(snap!.userId, 'u1')
    assert.equal(snap!.savedAt, NOW.toISOString())
    assert.equal(snap!.tickets.length, 1)
  })

  await test('another user never reads the snapshot', () => {
    const s = new MemoryStorage()
    saveOfflineTickets('u1', [booking()], NOW, s)
    assert.equal(readOfflineTickets('u2', NOW, s), null)
    assert.equal(readOfflineTickets(null, NOW, s), null)
  })

  await test('read drops tickets whose door window passed since the save', () => {
    const s = new MemoryStorage()
    saveOfflineTickets('u1', [booking()], NOW, s)
    const later = new Date(2026, 9, 22, 12, 0)
    assert.equal(readOfflineTickets('u1', later, s)!.tickets.length, 0)
  })

  await test('clear removes the snapshot', () => {
    const s = new MemoryStorage()
    saveOfflineTickets('u1', [booking()], NOW, s)
    clearOfflineTickets(s)
    assert.equal(readOfflineTickets('u1', NOW, s), null)
  })

  await test('storage throwing never throws out of save / read / clear', () => {
    assert.doesNotThrow(() => saveOfflineTickets('u1', [booking()], NOW, throwing))
    assert.equal(readOfflineTickets('u1', NOW, throwing), null)
    assert.doesNotThrow(() => clearOfflineTickets(throwing))
    assert.doesNotThrow(() => saveOfflineTickets('u1', [booking()], NOW, null))
    assert.equal(readOfflineTickets('u1', NOW, null), null)
  })

  await test('corrupt JSON reads as no snapshot', () => {
    const s = new MemoryStorage()
    s.setItem(OFFLINE_TICKETS_KEY, '{not json')
    assert.equal(readOfflineTickets('u1', NOW, s), null)
  })

  // sw-cache.ts reads the real localStorage; give Node one for these.
  const ls = new MemoryStorage()
  ;(globalThis as any).localStorage = ls
  ;(globalThis as any).fetch = async () => new Response('{}', { status: 200 })
  const swCache = await import('../src/lib/sw-cache')

  await test('user change on this device clears the previous user snapshot', async () => {
    ls.clear()
    await swCache.clearSwRuntimeCacheOnUserChange('u1')
    saveOfflineTickets('u1', [booking()], NOW, ls)
    await swCache.clearSwRuntimeCacheOnUserChange('u1')
    assert.ok(ls.getItem(OFFLINE_TICKETS_KEY), 'same user keeps it')
    await swCache.clearSwRuntimeCacheOnUserChange('u2')
    assert.equal(ls.getItem(OFFLINE_TICKETS_KEY), null)
    assert.equal(swCache.lastSignedInUserId(), 'u2')
  })

  await test('sign-out clears the snapshot before the session goes', async () => {
    ls.clear()
    saveOfflineTickets('u1', [booking()], NOW, ls)
    // next-auth's own signOut needs a browser; only the clearing is under test.
    const p = swCache.signOutAndClearCache({ redirect: false }).catch(() => {})
    assert.equal(ls.getItem(OFFLINE_TICKETS_KEY), null)
    await p
  })

  await test('lastSignedInUserId is null when storage throws', () => {
    ;(globalThis as any).localStorage = throwing
    assert.equal(swCache.lastSignedInUserId(), null)
    ;(globalThis as any).localStorage = ls
  })

  console.log(`\n${passed} passed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
