import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        venue: true,
        applications: { include: { artist: { include: { user: true } } } },
        lineup: { include: { artist: { include: { user: { select: { name: true, displayName: true } } } } } },
        ticketTiers: true,
        panelists: { orderBy: { order: 'asc' } },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN') {
      const organiser = await prisma.organiser.findUnique({ where: { id: event.organiserId } })
      if (!organiser || organiser.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // VenueBooking.eventId is a plain scalar, not a declared Prisma relation,
    // so it has to be looked up separately.
    const venueBooking = event.venueId
      ? await prisma.venueBooking.findFirst({ where: { eventId: event.id } })
      : null

    // Event.totalSeats/availableSeats are only ever kept accurate on the
    // flat/GA booking path - for NUMBERED venues they go stale, and go
    // especially wrong after a venue change (found live 29 Jul: an event
    // switched from a 65-seat venue to a 48-seat venue showed
    // "65 / 48 available" here - the old venue's leftover availableSeats
    // next to the new venue's totalSeats, available > total). Same fix
    // already applied on the public event page (26 Jul, session 33) -
    // recompute live from Seat/BookingSeat for NUMBERED venues instead of
    // trusting these columns.
    let totalSeats = event.totalSeats
    let availableSeats = event.availableSeats
    if (event.venue?.seatingMode === 'NUMBERED' && event.venueId) {
      const now = new Date()
      const [seatTotal, heldCount] = await Promise.all([
        prisma.seat.count({ where: { venueId: event.venueId } }),
        prisma.bookingSeat.count({
          where: {
            booking: {
              eventId: id,
              OR: [
                { status: 'CONFIRMED' },
                { status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
              ],
            },
          },
        }),
      ])
      totalSeats = seatTotal
      availableSeats = Math.max(0, seatTotal - heldCount)
    }

    return NextResponse.json({ ...event, totalSeats, availableSeats, venueBooking })
  } catch (err) {
    console.error('Error fetching event:', err)
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 })
  }
}
