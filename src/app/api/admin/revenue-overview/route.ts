import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { parseRange, getRangeStart, bucketKeyFor } from '@/lib/sales-range'
import { getPlatformSettings } from '@/lib/platform-settings'

/**
 * GET /api/admin/revenue-overview?range=week|month|quarter|year|all
 *
 * K4 — platform-wide admin revenue rollup (design.md §9.3). Distinct from
 * the per-venue (/api/venues/[id]/sales) and per-organiser sales views:
 * those show *their* gross revenue. This shows the platform's own actual
 * revenue, which per the "never tax the scene" ruling (fifth amendment)
 * is the audience-side booking fee only — Booking.bookingFeeAmount on
 * CONFIRMED bookings. Everything else (venue rental, performer fees,
 * ticket subtotal) is between other parties and passes through untaxed.
 *
 * Requires ADMIN role.
 */
async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  return user?.role === 'ADMIN' ? user : null
}

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const range = parseRange(searchParams.get('range'))
    const now = new Date()
    const rangeStart = getRangeStart(range, now)

    const confirmedBookings = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            organiser: { select: { id: true, orgName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const byOrganiser: Record<string, { orgName: string; platformFee: number; ticketSubtotal: number; bookings: number }> = {}
    const byEvent: Record<string, { title: string; platformFee: number; bookings: number }> = {}
    const timelineMap: Record<string, number> = {}

    let platformFeeTotal = 0
    let ticketSubtotalTotal = 0
    let freeBookingsCount = 0

    for (const b of confirmedBookings) {
      platformFeeTotal += b.bookingFeeAmount
      ticketSubtotalTotal += b.subtotalAmount
      if (b.subtotalAmount === 0 && b.bookingFeeAmount === 0) freeBookingsCount += 1

      const orgId = b.event.organiser.id
      if (!byOrganiser[orgId]) {
        byOrganiser[orgId] = { orgName: b.event.organiser.orgName, platformFee: 0, ticketSubtotal: 0, bookings: 0 }
      }
      byOrganiser[orgId].platformFee += b.bookingFeeAmount
      byOrganiser[orgId].ticketSubtotal += b.subtotalAmount
      byOrganiser[orgId].bookings += 1

      const eventId = b.event.id
      if (!byEvent[eventId]) {
        byEvent[eventId] = { title: b.event.title, platformFee: 0, bookings: 0 }
      }
      byEvent[eventId].platformFee += b.bookingFeeAmount
      byEvent[eventId].bookings += 1

      const key = bucketKeyFor(range, b.createdAt)
      timelineMap[key] = (timelineMap[key] || 0) + b.bookingFeeAmount
    }

    const organiserBreakdown = Object.entries(byOrganiser)
      .map(([organiserId, v]) => ({ organiserId, ...v }))
      .sort((a, b) => b.platformFee - a.platformFee)
      .slice(0, 20)

    const eventBreakdown = Object.entries(byEvent)
      .map(([eventId, v]) => ({ eventId, ...v }))
      .sort((a, b) => b.platformFee - a.platformFee)
      .slice(0, 20)

    const timeline = Object.entries(timelineMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue }))

    // Current fee setting, for context next to the actuals above.
    // Stored in paise (Int); convert to rupees for display consistency
    // with the money amounts above (which are already Float rupees).
    const settings = await getPlatformSettings()
    const currentFeeSettingRupees = settings.audienceBookingFee / 100

    return NextResponse.json({
      range,
      totals: {
        platformFeeTotal,
        ticketSubtotalTotal,
        confirmedBookingsCount: confirmedBookings.length,
        freeBookingsCount,
      },
      currentFeeSettingRupees,
      organisers: organiserBreakdown,
      events: eventBreakdown,
      timeline,
      generatedAt: now.toISOString(),
    })
  } catch (err) {
    console.error('Error fetching admin revenue overview:', err)
    return NextResponse.json({ error: 'Failed to fetch revenue overview' }, { status: 500 })
  }
}
