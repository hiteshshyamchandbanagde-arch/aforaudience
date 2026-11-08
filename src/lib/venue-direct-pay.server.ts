// D2 - DB side of direct-payment venue bookings: the 48-hour expiry pass,
// shared by the lazy check (on every read/action) and the 15-min cron.
// Pure rules live in venue-direct-pay.ts.
import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

/**
 * Expires every waiting (AWAITING_PAYMENT / PAID_MARKED) direct booking
 * whose window has passed, optionally scoped by `where`. Expired = the
 * booking is CANCELLED (slot released) with directPayStatus EXPIRED; a
 * linked event still held at PENDING_APPROVAL goes back to DRAFT, the same
 * as an expired negotiation. Returns how many bookings expired.
 */
export async function expireDirectPayBookings(
  where: Prisma.VenueBookingWhereInput = {},
  now: Date = new Date()
): Promise<number> {
  const due = await prisma.venueBooking.findMany({
    where: {
      ...where,
      directPayStatus: { in: ['AWAITING_PAYMENT', 'PAID_MARKED'] },
      expiresAt: { lt: now },
    },
    select: { id: true, eventId: true },
  })
  if (due.length === 0) return 0
  const res = await prisma.venueBooking.updateMany({
    where: {
      id: { in: due.map((b) => b.id) },
      directPayStatus: { in: ['AWAITING_PAYMENT', 'PAID_MARKED'] },
      expiresAt: { lt: now },
    },
    data: { status: 'CANCELLED', directPayStatus: 'EXPIRED' },
  })
  const eventIds = due.map((b) => b.eventId).filter((x): x is string => !!x)
  if (eventIds.length) {
    await prisma.event.updateMany({
      where: { id: { in: eventIds }, status: 'PENDING_APPROVAL' },
      data: { status: 'DRAFT' },
    })
  }
  return res.count
}
