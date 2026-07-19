import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// §9.4 twenty-fourth amendment - audience seat-picker data source.
//
// Public, no auth - same browse-first trust level as GET /api/events/[id]
// (seeing which seats are open shouldn't require login; booking still
// does, via POST /api/bookings).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        venue: { include: { seats: true } },
        ticketTiers: true,
        organiser: { include: { user: { select: { isSuspended: true } } } },
      },
    })

    if (!event || event.status !== 'APPROVED' || event.organiser.user.isSuspended) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (!event.venue || event.venue.seatingMode !== 'NUMBERED') {
      return NextResponse.json({ seatingMode: 'GENERAL_ADMISSION', seats: [] })
    }

    // A physical seat's occupancy is scoped to THIS event, not global -
    // the same venue hosts many events over time in the same seats.
    // Mirrors the existing tier-count capacity check in POST /api/bookings:
    // CONFIRMED, or PENDING with expiresAt still in the future/null.
    const now = new Date()
    const heldSeatRows = await prisma.bookingSeat.findMany({
      where: {
        booking: {
          eventId: id,
          OR: [
            { status: 'CONFIRMED' },
            { status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          ],
        },
      },
      select: { seatId: true },
    })
    const heldSeatIds = new Set(heldSeatRows.map((r) => r.seatId))

    // Price resolved by matching Seat.tierLabel to TicketTier.sectionName
    // (deliberately not a hard FK - see Seat model comment in schema).
    // A seat whose tierLabel has no matching tier has no price set for
    // this event yet - surfaced as priceUnset so the picker can grey it
    // out with an explanation instead of silently charging ₹0.
    const priceByTier = new Map(event.ticketTiers.map((t) => [t.sectionName, t.price]))

    const seats = event.venue.seats.map((s) => ({
      id: s.id,
      tierLabel: s.tierLabel,
      row: s.row,
      number: s.number,
      x: s.x,
      y: s.y,
      price: priceByTier.get(s.tierLabel) ?? null,
      status: heldSeatIds.has(s.id) ? 'taken' : priceByTier.has(s.tierLabel) ? 'available' : 'priceUnset',
    }))

    return NextResponse.json({
      seatingMode: 'NUMBERED',
      maxSeatsPerBooking: event.maxSeatsPerBooking,
      seats,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch seat map' }, { status: 500 })
  }
}
