import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/events/[id]/sales — real-time-ish ticket sales dashboard data
// for an Organiser (owner) or Admin. "Real-time" here means the frontend
// polls this endpoint on an interval; there's no websocket/Supabase
// Realtime infra in this codebase (everything goes through Prisma against
// the Session Pooler, not @supabase/supabase-js), so polling is the
// pragmatic choice rather than a new architectural dependency for one
// dashboard. See design doc E5.
//
// Only CONFIRMED bookings count as real sales/revenue — PENDING bookings
// (payment in progress, may still expire) are surfaced separately as
// "reserved, not yet paid" so an Organiser isn't misled about actual
// revenue. CANCELLED/REFUNDED never count.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { ticketTiers: true },
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

    const now = new Date()

    const [confirmedBookings, pendingBookings] = await Promise.all([
      prisma.booking.findMany({
        where: { eventId, status: 'CONFIRMED' },
        include: { user: { select: { name: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.booking.findMany({
        where: {
          eventId,
          status: 'PENDING',
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { seats: true, totalAmount: true },
      }),
    ])

    // Per-tier sold counts. Flat-price events (no TicketTier rows) book
    // everything under the implicit "General" key — mirrors the booking
    // creation logic in POST /api/bookings.
    const soldBySection: Record<string, number> = {}
    let totalSeatsSold = 0
    let subtotalRevenue = 0
    let bookingFeeRevenue = 0

    for (const b of confirmedBookings) {
      const seats = (b.seats as Record<string, number>) || {}
      for (const [section, qty] of Object.entries(seats)) {
        soldBySection[section] = (soldBySection[section] || 0) + Number(qty)
        totalSeatsSold += Number(qty)
      }
      subtotalRevenue += b.subtotalAmount
      bookingFeeRevenue += b.bookingFeeAmount
    }

    let pendingSeats = 0
    let pendingValue = 0
    for (const b of pendingBookings) {
      const seats = (b.seats as Record<string, number>) || {}
      pendingSeats += Object.values(seats).reduce((sum, qty) => sum + Number(qty), 0)
      pendingValue += b.totalAmount
    }

    const tiers =
      event.ticketTiers.length > 0
        ? event.ticketTiers.map((t) => ({
            sectionName: t.sectionName,
            price: t.price,
            totalSeats: t.totalSeats,
            sold: soldBySection[t.sectionName] || 0,
          }))
        : [
            {
              sectionName: 'General',
              price: event.isFree ? 0 : event.ticketPrice || 0,
              totalSeats: event.totalSeats,
              sold: soldBySection['General'] || 0,
            },
          ]

    // Sales-over-time, bucketed by day (event windows here run days to
    // weeks, so day granularity is the useful resolution — not hours).
    const timelineMap: Record<string, { seats: number; revenue: number }> = {}
    for (const b of confirmedBookings) {
      const day = b.createdAt.toISOString().slice(0, 10)
      const seats = (b.seats as Record<string, number>) || {}
      const seatCount = Object.values(seats).reduce((sum, qty) => sum + Number(qty), 0)
      if (!timelineMap[day]) timelineMap[day] = { seats: 0, revenue: 0 }
      timelineMap[day].seats += seatCount
      timelineMap[day].revenue += b.subtotalAmount
    }
    const timeline = Object.entries(timelineMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }))

    const recentBookings = confirmedBookings.slice(0, 10).map((b) => ({
      id: b.id,
      name: b.user.displayName || b.user.name,
      seats: b.seats,
      amount: b.totalAmount,
      createdAt: b.createdAt,
    }))

    return NextResponse.json({
      event: {
        id: event.id,
        title: event.title,
        totalSeats: event.totalSeats,
        availableSeats: event.availableSeats,
        isFree: event.isFree,
      },
      tiers,
      totals: {
        totalSeatsSold,
        totalCapacity: event.totalSeats,
        subtotalRevenue,
        bookingFeeRevenue,
        grossRevenue: subtotalRevenue + bookingFeeRevenue,
        confirmedBookingsCount: confirmedBookings.length,
        pendingSeats,
        pendingValue,
        pendingCount: pendingBookings.length,
      },
      timeline,
      recentBookings,
      generatedAt: now.toISOString(),
    })
  } catch (err) {
    console.error('Error fetching sales data:', err)
    return NextResponse.json({ error: 'Failed to fetch sales data' }, { status: 500 })
  }
}
