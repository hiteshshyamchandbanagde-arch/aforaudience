// BUG-2610-018 - an unpaid PENDING hold whose 15-minute payment window
// has run out is not a ticket. My Tickets splits /api/bookings/my into
// the bookings that get a ticket card and, at most one per event, a
// compact "Unfinished checkout · Book again" row:
//   - only within 24 h of the hold's expiry (older ones are hidden),
//   - never when the person already holds a CONFIRMED booking for that
//     event, or a hold that is still live (that one keeps its Pay now card).
// No data changes: the rows stay in the database for audit.

export const UNFINISHED_CHECKOUT_WINDOW_MS = 24 * 60 * 60 * 1000

export interface HoldLike {
  status: string
  expiresAt: string | null
  event: { id: string }
}

/** A PENDING booking whose payment hold has run out. */
export function isExpiredHold(b: HoldLike, now: Date = new Date()): boolean {
  return b.status === 'PENDING' && !!b.expiresAt && new Date(b.expiresAt).getTime() < now.getTime()
}

export function splitUnfinishedCheckouts<T extends HoldLike>(bookings: T[], now: Date = new Date()): { tickets: T[]; unfinished: T[] } {
  const tickets = bookings.filter((b) => !isExpiredHold(b, now))
  // Events that already have a ticket card for this person: a confirmed
  // booking, or a live hold with its own Pay now.
  const covered = new Set(tickets.filter((b) => b.status === 'CONFIRMED' || b.status === 'PENDING').map((b) => b.event.id))
  const latest = new Map<string, T>()
  for (const b of bookings) {
    if (!isExpiredHold(b, now) || covered.has(b.event.id)) continue
    if (now.getTime() - new Date(b.expiresAt!).getTime() > UNFINISHED_CHECKOUT_WINDOW_MS) continue
    const seen = latest.get(b.event.id)
    if (!seen || new Date(b.expiresAt!).getTime() > new Date(seen.expiresAt!).getTime()) latest.set(b.event.id, b)
  }
  const unfinished = [...latest.values()].sort((a, b) => new Date(b.expiresAt!).getTime() - new Date(a.expiresAt!).getTime())
  return { tickets, unfinished }
}
