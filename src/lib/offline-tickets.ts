// BUG-2610-001 - offline tickets. /api is never cached by the service
// worker (public/sw.js), so the bookings a venue door needs have to be
// kept by the page itself: each online load of My Tickets saves a small
// snapshot of the signed-in user's upcoming confirmed tickets, and the
// page shows it when the network is down. Only what the door needs: no
// amounts, no payment details, no other users. Keyed by userId and read
// back only for the last signed-in user on this device; src/lib/sw-cache.ts
// deletes it on sign-out and on a user change.
//
// Every storage call is wrapped: private mode, a full quota or blocked
// site data must never break the online page.

import { eventStartInstant as startInstant } from './refund-policy'

export const OFFLINE_TICKETS_KEY = 'afa-offline-tickets'

// A ticket stays in the snapshot until this long after its start time,
// so someone arriving late at the door still has it.
export const DOOR_GRACE_MS = 12 * 60 * 60 * 1000

export interface OfflineTicket {
  // The booking id, which is also the QR payload (same as the PDF ticket).
  id: string
  ticketCode: string | null
  tierNames: string[]
  qty: number
  checkedInAt: string | null
  event: {
    id: string
    title: string
    date: string
    startTime: string
    type: string
    venue: { name: string; city: string } | null
  }
}

export interface OfflineTicketsSnapshot {
  userId: string
  savedAt: string
  tickets: OfflineTicket[]
}

// The subset of /api/bookings/my's booking shape this file reads.
export interface SnapshotSourceBooking {
  id: string
  status: string
  seats: Record<string, number>
  seatLabels?: string[]
  tierNames?: string[]
  ticketCode: string | null
  checkedInAt: string | null
  event: {
    id: string
    title: string
    date: string
    startTime: string
    type: string
    venue: { name: string; city: string } | null
  }
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function toOfflineTickets(bookings: SnapshotSourceBooking[], now: Date = new Date()): OfflineTicket[] {
  return bookings
    .filter((b) => b.status === 'CONFIRMED')
    .filter((b) => startInstant(b.event.date, b.event.startTime).getTime() + DOOR_GRACE_MS > now.getTime())
    .map((b) => ({
      id: b.id,
      ticketCode: b.ticketCode ?? null,
      tierNames: b.tierNames ?? Object.keys(b.seats || {}),
      qty: b.seatLabels && b.seatLabels.length > 0 ? b.seatLabels.length : Object.values(b.seats || {}).reduce((sum, n) => sum + n, 0),
      checkedInAt: b.checkedInAt ?? null,
      event: {
        id: b.event.id,
        title: b.event.title,
        date: b.event.date,
        startTime: b.event.startTime,
        type: b.event.type,
        venue: b.event.venue ? { name: b.event.venue.name, city: b.event.venue.city } : null,
      },
    }))
}

export function saveOfflineTickets(
  userId: string,
  bookings: SnapshotSourceBooking[],
  now: Date = new Date(),
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage || !userId) return
  const snapshot: OfflineTicketsSnapshot = { userId, savedAt: now.toISOString(), tickets: toOfflineTickets(bookings, now) }
  try {
    storage.setItem(OFFLINE_TICKETS_KEY, JSON.stringify(snapshot))
  } catch {
    // Quota or blocked storage: no offline copy this time, the page is fine.
  }
}

// Returns the snapshot only when it belongs to `userId` (the signed-in
// user, or the last one seen on this device when offline). Anything else
// - no snapshot, someone else's, unreadable - is null.
export function readOfflineTickets(
  userId: string | null,
  now: Date = new Date(),
  storage: StorageLike | null = defaultStorage(),
): OfflineTicketsSnapshot | null {
  if (!storage || !userId) return null
  try {
    const raw = storage.getItem(OFFLINE_TICKETS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OfflineTicketsSnapshot
    if (!parsed || parsed.userId !== userId || !Array.isArray(parsed.tickets)) return null
    // Drop tickets whose door window has passed since the save.
    const tickets = parsed.tickets.filter(
      (t) => startInstant(t.event.date, t.event.startTime).getTime() + DOOR_GRACE_MS > now.getTime(),
    )
    return { ...parsed, tickets }
  } catch {
    return null
  }
}

export function clearOfflineTickets(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.removeItem(OFFLINE_TICKETS_KEY)
  } catch {
    // Nothing readable to leak either.
  }
}
