import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { parseRange, getRangeStart, bucketKeyFor } from '@/lib/sales-range'

// GET /api/organisers/sales-overview?range=week|month|quarter|year|all
//
// Cross-event aggregate for the Organiser sales overview page. Per-event
// drill-down still goes through the existing /api/events/[id]/sales
// endpoint. Only CONFIRMED bookings count toward revenue/tickets here —
// same rule as the per-event endpoint.
//
// Range filters *when a booking was made* (createdAt), not the event
// date — this is a sales-activity view ("how much did I sell this
// month"), not an event-schedule view.
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

    let organiserId: string | null = null
    if (user.role === 'ADMIN') {
      const { searchParams } = new URL(req.url)
      organiserId = searchParams.get('organiserId')
      if (!organiserId) {
        return NextResponse.json({ error: 'organiserId required for admin' }, { status: 400 })
      }
    } else {
      if (user.role !== 'ORGANISER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const organiser = await prisma.organiser.findUnique({ where: { userId: user.id } })
      if (!organiser) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      organiserId = organiser.id
    }

    const { searchParams } = new URL(req.url)
    const range = parseRange(searchParams.get('range'))
    const now = new Date()
    const rangeStart = getRangeStart(range, now)

    const events = await prisma.event.findMany({
      where: { organiserId },
      include: { ticketTiers: true },
      orderBy: { createdAt: 'desc' },
    })
    const eventIds = events.map((e) => e.id)

    const confirmedBookings = eventIds.length
      ? await prisma.booking.findMany({
          where: {
            eventId: { in: eventIds },
            status: 'CONFIRMED',
            ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
          },
          select: { eventId: true, seats: true, subtotalAmount: true, bookingFeeAmount: true, totalAmount: true, createdAt: true },
        })
      : []

    const byEvent: Record<string, { revenue: number; ticketsSold: number; bookings: number }> = {}
    let grossRevenue = 0
    let ticketsSold = 0
    const timelineMap: Record<string, number> = {}

    for (const b of confirmedBookings) {
      const seats = (b.seats as Record<string, number>) || {}
      const seatCount = Object.values(seats).reduce((sum, q) => sum + Number(q), 0)
      const revenue = b.subtotalAmount + b.bookingFeeAmount

      if (!byEvent[b.eventId]) byEvent[b.eventId] = { revenue: 0, ticketsSold: 0, bookings: 0 }
      byEvent[b.eventId].revenue += revenue
      byEvent[b.eventId].ticketsSold += seatCount
      byEvent[b.eventId].bookings += 1

      grossRevenue += revenue
      ticketsSold += seatCount

      const key = bucketKeyFor(range, b.createdAt)
      timelineMap[key] = (timelineMap[key] || 0) + revenue
    }

    const eventBreakdown = events
      .map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        totalSeats: e.totalSeats,
        revenue: byEvent[e.id]?.revenue || 0,
        ticketsSold: byEvent[e.id]?.ticketsSold || 0,
        bookings: byEvent[e.id]?.bookings || 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    const timeline = Object.entries(timelineMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue }))

    return NextResponse.json({
      range,
      totals: {
        grossRevenue,
        ticketsSold,
        eventsCount: events.length,
        confirmedBookingsCount: confirmedBookings.length,
      },
      events: eventBreakdown,
      timeline,
      generatedAt: now.toISOString(),
    })
  } catch (err) {
    console.error('Error fetching organiser sales overview:', err)
    return NextResponse.json({ error: 'Failed to fetch sales overview' }, { status: 500 })
  }
}
