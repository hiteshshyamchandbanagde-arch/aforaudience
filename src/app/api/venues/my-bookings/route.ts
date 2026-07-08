import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user || user.role !== 'VENUE_OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const venueOwner = await prisma.venueOwner.findUnique({ where: { userId: user.id } })
    if (!venueOwner) {
      return NextResponse.json([])
    }

    const venues = await prisma.venue.findMany({ where: { ownerId: venueOwner.id }, select: { id: true } })
    const venueIds = venues.map((v) => v.id)

    const bookings = await prisma.venueBooking.findMany({
      where: { venueId: { in: venueIds } },
      include: {
        venue: { select: { id: true, name: true, city: true } },
        organiser: { select: { orgName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Event title isn't a declared Prisma relation on VenueBooking, so
    // attach it manually where an eventId is present.
    const eventIds = bookings.map((b) => b.eventId).filter(Boolean) as string[]
    const events = eventIds.length
      ? await prisma.event.findMany({ where: { id: { in: eventIds } }, select: { id: true, title: true, date: true } })
      : []
    const eventMap = new Map(events.map((e) => [e.id, e]))

    const result = bookings.map((b) => ({ ...b, event: b.eventId ? eventMap.get(b.eventId) || null : null }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('Error fetching venue bookings:', err)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}
