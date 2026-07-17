import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/venues/[id]/sales — revenue dashboard for a Venue Owner (or
// Admin), same shape/intent as the Organiser ticket-sales dashboard (E5)
// but for venue rentals rather than ticket sales.
//
// Per the fifth amendment ("never tax the scene"), the platform takes no
// cut of venue rentals — VenueBooking.amount IS the venue owner's full
// revenue, no fee to subtract. So this is simpler than the ticket-sales
// endpoint: no subtotal/fee split, just CONFIRMED booking amounts.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: venueId } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const venue = await prisma.venue.findUnique({ where: { id: venueId } })
    if (!venue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN') {
      const venueOwner = await prisma.venueOwner.findUnique({ where: { id: venue.ownerId } })
      if (!venueOwner || venueOwner.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const now = new Date()

    const [confirmed, pending] = await Promise.all([
      prisma.venueBooking.findMany({
        where: { venueId, status: 'CONFIRMED' },
        include: { organiser: { select: { orgName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.venueBooking.findMany({
        where: { venueId, status: 'PENDING' },
        select: { amount: true },
      }),
    ])

    const grossRevenue = confirmed.reduce((sum, b) => sum + b.amount, 0)
    const upcomingCount = confirmed.filter((b) => b.fromDate >= now).length
    const completedCount = confirmed.filter((b) => b.toDate < now).length

    const pendingValue = pending.reduce((sum, b) => sum + b.amount, 0)

    // Event title isn't a declared Prisma relation on VenueBooking (same
    // gap noted in /api/venues/my-bookings) — attach manually.
    const eventIds = confirmed.map((b) => b.eventId).filter(Boolean) as string[]
    const events = eventIds.length
      ? await prisma.event.findMany({ where: { id: { in: eventIds } }, select: { id: true, title: true } })
      : []
    const eventTitleMap = new Map(events.map((e) => [e.id, e.title]))

    const timelineMap: Record<string, number> = {}
    for (const b of confirmed) {
      const day = b.createdAt.toISOString().slice(0, 10)
      timelineMap[day] = (timelineMap[day] || 0) + b.amount
    }
    const timeline = Object.entries(timelineMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue }))

    const recentBookings = confirmed.slice(0, 10).map((b) => ({
      id: b.id,
      organiserName: b.organiser.orgName,
      eventTitle: b.eventId ? eventTitleMap.get(b.eventId) || null : null,
      fromDate: b.fromDate,
      toDate: b.toDate,
      amount: b.amount,
      createdAt: b.createdAt,
    }))

    return NextResponse.json({
      venue: { id: venue.id, name: venue.name, city: venue.city, capacity: venue.capacity },
      totals: {
        grossRevenue,
        confirmedBookingsCount: confirmed.length,
        upcomingCount,
        completedCount,
        pendingCount: pending.length,
        pendingValue,
      },
      timeline,
      recentBookings,
      generatedAt: now.toISOString(),
    })
  } catch (err) {
    console.error('Error fetching venue sales data:', err)
    return NextResponse.json({ error: 'Failed to fetch venue sales data' }, { status: 500 })
  }
}
