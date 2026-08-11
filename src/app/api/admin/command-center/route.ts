import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/admin/command-center
//
// Session 47 — single-round-trip rollup for the admin landing page
// (design.md §9.6). Previously /dashboard/admin was just a redirect
// straight into the Feedback board — an admin never saw the big picture,
// only a filtered list. This aggregates across Feedback, Approvals, and
// Bookings/Revenue so "what needs my attention right now" is answerable
// in one glance, without navigating into each sub-page first.
//
// Deliberately server-aggregated (not client-side over multiple fetches
// like the Feedback page) — command-center counts are cheap COUNT/groupBy
// queries, no need to ship full row data to the browser just to tally it.

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: { id: true, role: true },
  })
  if (!user || user.role !== 'ADMIN') return null
  return user
}

function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const fourteenDaysAgo = new Date(startOfDay(now))
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13)

  const [
    feedbackAll,
    pendingOrganisers,
    pendingVenueOwners,
    pendingGenreRequests,
    pendingEventNotes,
    erroredDeliveries,
    monthBookings,
  ] = await Promise.all([
    prisma.feedback.findMany({
      where: { createdAt: { gte: fourteenDaysAgo } },
      select: { category: true, status: true, severity: true, createdAt: true, resolvedAt: true },
    }),
    prisma.organiser.count({ where: { isApproved: false } }),
    prisma.venueOwner.count({ where: { isApproved: false } }),
    prisma.genreRequest.count({ where: { status: 'PENDING' } }).catch(() => 0),
    // FEAT-2608-045 (11 Aug) - pending event special notes, same
    // attention-queue treatment as pending genre requests above.
    prisma.event.count({ where: { specialNotesStatus: 'PENDING' } }).catch(() => 0),
    prisma.booking.count({ where: { status: 'CONFIRMED', deliveredAt: null, deliveryError: { not: null } } }),
    prisma.booking.findMany({
      where: { status: 'CONFIRMED', createdAt: { gte: monthStart } },
      select: { bookingFeeAmount: true },
    }),
  ])

  // Full-history counts (not just the 14-day window used for the daily
  // chart) — a separate lightweight groupBy so the KPI totals reflect
  // everything, matching what the Feedback board itself shows.
  const statusCounts = await prisma.feedback.groupBy({
    by: ['status'],
    _count: { _all: true },
  })
  const categoryCounts = await prisma.feedback.groupBy({
    by: ['category'],
    _count: { _all: true },
  })
  const openCriticalHigh = await prisma.feedback.count({
    where: {
      // Workflow overhaul (session 63) - "open" now means anything not
      // RESOLVED/REJECTED, not just the old 3-value NEW/REVIEWED/TESTED
      // set. Same OPEN_STATUSES list as /api/admin/feedback's default
      // board query.
      status: { in: ['NEW', 'UNDER_REVIEW', 'BUILD_QUEUE', 'IN_BUILD', 'BUILD_COMPLETE', 'IN_TEST', 'REOPENED'] },
      severity: { in: ['HIGH', 'CRITICAL'] },
    },
  })

  const statusMap: Record<string, number> = {}
  for (const s of statusCounts) statusMap[s.status] = s._count._all
  const featureIdeasCount = categoryCounts.find((c: { category: string }) => c.category === 'FEATURE_IDEA')?._count._all || 0

  const dailyBuckets: { day: string; opened: number; resolved: number }[] = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(fourteenDaysAgo)
    d.setDate(d.getDate() + i)
    dailyBuckets.push({ day: d.toISOString().slice(0, 10), opened: 0, resolved: 0 })
  }
  const dayIndex = (date: Date) => {
    const key = startOfDay(date).toISOString().slice(0, 10)
    return dailyBuckets.findIndex((b) => b.day === key)
  }
  for (const item of feedbackAll) {
    const oi = dayIndex(new Date(item.createdAt))
    if (oi >= 0) dailyBuckets[oi].opened += 1
    if (item.resolvedAt) {
      const ri = dayIndex(new Date(item.resolvedAt))
      if (ri >= 0) dailyBuckets[ri].resolved += 1
    }
  }

  const monthRevenue = monthBookings.reduce((sum: number, b: { bookingFeeAmount: number }) => sum + b.bookingFeeAmount, 0)

  const attention: { label: string; count: number; href: string; tone: 'critical' | 'warning' }[] = []
  if (openCriticalHigh > 0) {
    attention.push({ label: 'High/critical bugs open', count: openCriticalHigh, href: '/dashboard/admin/feedback', tone: 'critical' })
  }
  if (erroredDeliveries > 0) {
    attention.push({ label: 'Ticket deliveries errored', count: erroredDeliveries, href: '/dashboard/admin/bookings', tone: 'critical' })
  }
  const pendingApprovals = pendingOrganisers + pendingVenueOwners
  if (pendingApprovals > 0) {
    attention.push({ label: 'Approvals waiting', count: pendingApprovals, href: '/dashboard/admin/feedback', tone: 'warning' })
  }
  if (pendingGenreRequests > 0) {
    attention.push({ label: 'Genre requests waiting', count: pendingGenreRequests, href: '/dashboard/admin/feedback', tone: 'warning' })
  }
  if (pendingEventNotes > 0) {
    attention.push({ label: 'Event notes waiting', count: pendingEventNotes, href: '/dashboard/admin/feedback', tone: 'warning' })
  }

  return NextResponse.json({
    kpis: {
      totalFeedback: Object.values(statusMap).reduce((a, b) => a + b, 0),
      pending: (statusMap['NEW'] || 0) + (statusMap['UNDER_REVIEW'] || 0),
      // "tested" -> "inTest" (mirrors FeedbackTrends' regrouping) - also
      // folds REOPENED in, since a reopened item is back in the same
      // "still being worked" bucket as IN_TEST from a KPI standpoint.
      tested: (statusMap['IN_TEST'] || 0) + (statusMap['REOPENED'] || 0),
      resolved: statusMap['RESOLVED'] || 0,
      featureIdeas: featureIdeasCount,
      pendingApprovals,
      monthRevenue,
      monthBookings: monthBookings.length,
      erroredDeliveries,
    },
    attention,
    dailyTrend: dailyBuckets,
    generatedAt: now.toISOString(),
  })
}
