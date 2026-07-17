import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { parseRange, getRangeStart, bucketKeyFor } from '@/lib/sales-range'

// GET /api/events/[id]/sales?range=week|month|quarter|year|all — real-
// time-ish ticket sales dashboard data for an Organiser (owner) or Admin.
// "Real-time" here means the frontend polls this endpoint on an
// interval; there's no websocket/Supabase Realtime infra in this
// codebase (everything goes through Prisma against the Session Pooler,
// not @supabase/supabase-js), so polling is the pragmatic choice rather
// than a new architectural dependency for one dashboard. See design doc
// E5.
//
// Only CONFIRMED bookings count as real sales/revenue — PENDING bookings
// (payment in progress, may still expire) are surfaced separately as
// "reserved, not yet paid" so an Organiser isn't misled about actual
// revenue. CANCELLED/REFUNDED never count.
//
// `range` scopes revenue/timeline/recent-bookings to "sales made in this
// window" (booking createdAt). Per-tier `sold` counts and pending
// reservations deliberately stay all-time / current-state — seats
// occupied and reservations in flight aren't meaningful "per period"
// figures, they're the live state of the event.
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

    const { searchParams } = new URL(req.url)
    const range = parseRange(searchParams.get('range'))
    const now = new Date()
    const rangeStart = getRangeStart(range, now)

    const [allConfirmedBookings, pendingBookings] = await Promise.all([
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

    // All-time: per-tier sold counts + total seats sold. Flat-price
    // events (no TicketTier rows) book everything under the implicit
    // "General" key — mirrors the booking creation logic in
    // POST /api/bookings.
    const soldBySection: Record<string, number> = {}
    let totalSeatsSold = 0
    for (const b of allConfirmedBookings) {
      const seats = (b.seats as Record<string, number>) || {}
      for (const [section, qty] of Object.entries(seats)) {
        soldBySection[section] = (soldBySection[section] || 0) + Number(qty)
        totalSeatsSold += Number(qty)
      }
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

    // Range-scoped: revenue, timeline, recent bookings.
    const inRangeBookings = rangeStart
      ? allConfirmedBookings.filter((b) => b.createdAt >= rangeStart)
      : allConfirmedBookings

    let subtotalRevenue = 0
    let bookingFeeRevenue = 0
    let ticketsSoldInRange = 0
    const timelineMap: Record<string, { seats: number; revenue: number }> = {}

    for (const b of inRangeBookings) {
      subtotalRevenue += b.subtotalAmount
      bookingFeeRevenue += b.bookingFeeAmount
      const seats = (b.seats as Record<string, number>) || {}
      const seatCount = Object.values(seats).reduce((sum, qty) => sum + Number(qty), 0)
      ticketsSoldInRange += seatCount

      const key = bucketKeyFor(range, b.createdAt)
      if (!timelineMap[key]) timelineMap[key] = { seats: 0, revenue: 0 }
      timelineMap[key].seats += seatCount
      timelineMap[key].revenue += b.subtotalAmount
    }
    const timeline = Object.entries(timelineMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }))

    // Pending — always "right now", not range-scoped.
    let pendingSeats = 0
    let pendingValue = 0
    for (const b of pendingBookings) {
      const seats = (b.seats as Record<string, number>) || {}
      pendingSeats += Object.values(seats).reduce((sum, qty) => sum + Number(qty), 0)
      pendingValue += b.totalAmount
    }

    const recentBookings = inRangeBookings.slice(0, 10).map((b) => ({
      id: b.id,
      name: b.user.displayName || b.user.name,
      seats: b.seats,
      amount: b.totalAmount,
      createdAt: b.createdAt,
    }))

    return NextResponse.json({
      range,
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
        ticketsSoldInRange,
        subtotalRevenue,
        bookingFeeRevenue,
        grossRevenue: subtotalRevenue + bookingFeeRevenue,
        confirmedBookingsCount: inRangeBookings.length,
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
