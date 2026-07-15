import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/admin/bookings
 *
 * Powers /dashboard/admin/bookings — the surface that finally lets an
 * admin see, without a DB console, which bookings hit ticket-delivery
 * errors and click "retry" instead of curl'ing the redeliver endpoint.
 *
 * Requires ADMIN role.
 *
 * Query params (all optional):
 *   status: 'errored' | 'delivered' | 'pending' | 'all'   (default 'all')
 *   limit:  1-200                                          (default 50)
 *
 * Filter semantics (booking is CONFIRMED in all cases — PENDING /
 * CANCELLED / REFUNDED are never in scope for delivery):
 *   errored   -> deliveredAt IS NULL AND deliveryError IS NOT NULL
 *   pending   -> deliveredAt IS NULL AND deliveryError IS NULL
 *                (in flight, or the atomic single-flight claim was
 *                 taken and delivery hasn't returned yet)
 *   delivered -> deliveredAt IS NOT NULL
 *   all       -> everything CONFIRMED
 *
 * Sorted newest first. No pagination beyond limit — at current volume
 * (~20 bookings total across QA history) a single page is fine.
 * Revisit if the errored bucket alone crosses a screen.
 */

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  return user?.role === 'ADMIN' ? user : null
}

export async function GET(req: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const statusParam = searchParams.get('status') ?? 'all'
  const limitRaw = parseInt(searchParams.get('limit') ?? '50', 10)
  const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50))

  const deliveryFilter =
    statusParam === 'errored'
      ? { deliveredAt: null, deliveryError: { not: null } }
      : statusParam === 'delivered'
      ? { deliveredAt: { not: null } }
      : statusParam === 'pending'
      ? { deliveredAt: null, deliveryError: null }
      : {}

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      ...deliveryFilter,
    },
    include: {
      user: { select: { name: true, email: true, displayName: true } },
      event: { select: { title: true, date: true, isFree: true } },
      payment: {
        select: {
          status: true,
          razorpayPaymentId: true,
          amount: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  // Counts for the filter tabs. Cheap at MVP volume; one query per bucket
  // rather than fetching everything and counting client-side, so an admin
  // with a stale tab doesn't miss items that landed after they opened it.
  const [erroredCount, deliveredCount, pendingCount, totalCount] = await Promise.all([
    prisma.booking.count({
      where: { status: 'CONFIRMED', deliveredAt: null, deliveryError: { not: null } },
    }),
    prisma.booking.count({
      where: { status: 'CONFIRMED', deliveredAt: { not: null } },
    }),
    prisma.booking.count({
      where: { status: 'CONFIRMED', deliveredAt: null, deliveryError: null },
    }),
    prisma.booking.count({ where: { status: 'CONFIRMED' } }),
  ])

  return NextResponse.json({
    bookings,
    counts: {
      errored: erroredCount,
      delivered: deliveredCount,
      pending: pendingCount,
      all: totalCount,
    },
  })
}
