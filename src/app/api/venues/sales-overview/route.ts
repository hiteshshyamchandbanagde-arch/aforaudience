import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { parseRange, getRangeStart, bucketKeyFor } from '@/lib/sales-range'

// GET /api/venues/sales-overview?range=week|month|quarter|year|all
//
// Cross-venue aggregate for the Venue Owner revenue overview page.
// Per-venue drill-down still goes through /api/venues/[id]/sales.
// Mirrors /api/organisers/sales-overview in shape; the one structural
// difference is the extra "by organiser" breakdown — which organisers
// are renting the most / spending the most across all of this owner's
// venues. That's the "drill to organiser level" the venue owner asked
// for, done as a sortable table rather than a dedicated per-organiser
// page (design doc §9.1 phasing decision — revisit only if real usage
// shows a need for more).
//
// Per the fifth amendment ("never tax the scene"), venue rentals carry
// no platform cut — VenueBooking.amount IS the owner's revenue, no
// subtotal/fee split needed here (unlike the ticket-sales overview).
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let venueOwnerId: string | null = null
    if (user.role === 'ADMIN') {
      const { searchParams } = new URL(req.url)
      venueOwnerId = searchParams.get('venueOwnerId')
      if (!venueOwnerId) {
        return NextResponse.json({ error: 'venueOwnerId required for admin' }, { status: 400 })
      }
    } else {
      if (user.role !== 'VENUE_OWNER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const venueOwner = await prisma.venueOwner.findUnique({ where: { userId: user.id } })
      if (!venueOwner) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      venueOwnerId = venueOwner.id
    }

    const { searchParams } = new URL(req.url)
    const range = parseRange(searchParams.get('range'))
    const now = new Date()
    const rangeStart = getRangeStart(range, now)

    const venues = await prisma.venue.findMany({
      where: { ownerId: venueOwnerId },
      orderBy: { createdAt: 'desc' },
    })
    const venueIds = venues.map((v) => v.id)

    const confirmedBookings = venueIds.length
      ? await prisma.venueBooking.findMany({
          where: {
            venueId: { in: venueIds },
            status: 'CONFIRMED',
            ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
          },
          include: { organiser: { select: { id: true, orgName: true } } },
          orderBy: { createdAt: 'desc' },
        })
      : []

    const byVenue: Record<string, { revenue: number; bookings: number }> = {}
    const byOrganiser: Record<string, { orgName: string; revenue: number; bookings: number }> = {}
    const timelineMap: Record<string, number> = {}
    let grossRevenue = 0

    for (const b of confirmedBookings) {
      if (!byVenue[b.venueId]) byVenue[b.venueId] = { revenue: 0, bookings: 0 }
      byVenue[b.venueId].revenue += b.amount
      byVenue[b.venueId].bookings += 1

      const orgKey = b.organiser.id
      if (!byOrganiser[orgKey]) byOrganiser[orgKey] = { orgName: b.organiser.orgName, revenue: 0, bookings: 0 }
      byOrganiser[orgKey].revenue += b.amount
      byOrganiser[orgKey].bookings += 1

      grossRevenue += b.amount

      const key = bucketKeyFor(range, b.createdAt)
      timelineMap[key] = (timelineMap[key] || 0) + b.amount
    }

    const venueBreakdown = venues
      .map((v) => ({
        id: v.id,
        name: v.name,
        city: v.city,
        capacity: v.capacity,
        revenue: byVenue[v.id]?.revenue || 0,
        bookings: byVenue[v.id]?.bookings || 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    const organiserBreakdown = Object.entries(byOrganiser)
      .map(([organiserId, v]) => ({ organiserId, orgName: v.orgName, revenue: v.revenue, bookings: v.bookings }))
      .sort((a, b) => b.revenue - a.revenue)

    const timeline = Object.entries(timelineMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue }))

    return NextResponse.json({
      range,
      totals: {
        grossRevenue,
        venuesCount: venues.length,
        confirmedBookingsCount: confirmedBookings.length,
      },
      venues: venueBreakdown,
      organisers: organiserBreakdown,
      timeline,
      generatedAt: now.toISOString(),
    })
  } catch (err) {
    console.error('Error fetching venue owner sales overview:', err)
    return NextResponse.json({ error: 'Failed to fetch sales overview' }, { status: 500 })
  }
}
