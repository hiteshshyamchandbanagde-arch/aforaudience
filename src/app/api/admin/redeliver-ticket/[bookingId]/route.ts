import { NextResponse, after } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { deliverTicket } from '@/lib/ticket-delivery'

/**
 * POST /api/admin/redeliver-ticket/[bookingId]
 *
 * Force-retries ticket delivery for a booking. Closes the loop that
 * `Booking.deliveryError` opens: we now capture failure reasons on
 * every delivery attempt, but until this endpoint existed the only
 * way to act on that was to open a DB console and clear the columns
 * manually. This endpoint does that safely.
 *
 * Requires ADMIN role. Not exposed on any non-admin surface.
 *
 * Behavior:
 *   - Loads the booking, verifies it's CONFIRMED (never PENDING /
 *     CANCELLED — those aren't eligible for delivery in the first
 *     place).
 *   - Atomically resets `deliveredAt` and `deliveryError` to NULL,
 *     gated on the booking being in one of three safe-to-clear states:
 *     (a) failed (`deliveredAt IS NULL AND deliveryError IS NOT NULL`),
 *     (b) previously delivered more than 30 seconds ago (force-resend),
 *     or (c) never attempted (`deliveredAt IS NULL AND deliveryError
 *     IS NULL`) and the booking is older than 5 minutes. The 30-second
 *     window protects against admin double-tap and against a race with
 *     an in-flight delivery attempt fired by the confirm route or
 *     webhook; the 5-minute age guard on (c) prevents racing with a
 *     currently-executing delivery whose atomic claim hasn't landed.
 *   - Fires `deliverTicket()` in the background (same pattern as the
 *     confirm route — never blocks the admin's HTTP request on Resend).
 *
 * Concurrency correctness:
 *   Two admins tapping "retry" within the same second would BOTH try
 *   to clear the state. Whichever one clears first wins; the second
 *   finds the (now-updated) `deliveredAt` too recent (set by the first
 *   caller's deliverTicket claim) and gets a 409 response. Meanwhile
 *   deliverTicket itself is idempotent via its own atomic claim, so
 *   even if two clears somehow race through, only one email actually
 *   sends. Belt-and-suspenders.
 *
 * Returns:
 *   200 { ok, note } — reset succeeded, redelivery is in flight
 *   404 — booking not found
 *   403 — caller is not an admin
 *   409 — booking was updated too recently to safely retry
 *   400 — booking is not in a state where redelivery makes sense
 */

const RETRY_COOLDOWN_MS = 30 * 1000
// Bookings that were never delivered AND never captured an error are
// eligible for retry only after this age — that guard prevents racing
// with a currently-executing delivery attempt whose own atomic claim
// hasn't landed yet. In practice deliverTicket claims and settles in
// well under a second; five minutes is very generous.
const NEVER_ATTEMPTED_MIN_AGE_MS = 5 * 60 * 1000

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const user = await prisma.user.findUnique({
    where: { id: (session.user as { id: string }).id },
  })
  return user?.role === 'ADMIN' ? user : null
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { bookingId } = await params
  if (!bookingId) {
    return NextResponse.json({ error: 'bookingId is required' }, { status: 400 })
  }

  // Load the booking to give the admin a useful error message if the
  // request doesn't make sense (wrong ID, cancelled booking, etc).
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      deliveredAt: true,
      deliveryError: true,
      userId: true,
      totalAmount: true,
    },
  })

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  if (booking.status !== 'CONFIRMED') {
    return NextResponse.json(
      {
        error: `Cannot redeliver ticket for a ${booking.status} booking. Only CONFIRMED bookings are eligible.`,
      },
      { status: 400 }
    )
  }

  // Atomic reset gated on state. Three branches are safe to clear:
  //
  //   (a) Previous delivery attempt captured an error but never fully
  //       delivered — `deliveredAt IS NULL AND deliveryError IS NOT NULL`.
  //       Textbook retry case.
  //
  //   (b) A previous delivery succeeded, but it was more than 30s ago,
  //       so a manual re-send is safe (e.g., audience says "didn't get
  //       the email" — admin force-resends).
  //
  //   (c) Never attempted — `deliveredAt IS NULL AND deliveryError IS
  //       NULL` AND the booking is older than NEVER_ATTEMPTED_MIN_AGE_MS.
  //       This covers historical residue: bookings that predate the
  //       delivery pipeline (Checkpoint 3, 13 Jul), free-event bookings
  //       created before M1 landed (14 Jul), or any other row that
  //       slipped through a code path without a delivery attempt firing.
  //       The age guard prevents racing with a currently-executing
  //       delivery attempt whose atomic claim hasn't landed yet.
  //
  // If none match, either the delivery is currently in-flight
  // (deliveredAt set <30s ago by our own claim), the booking is too
  // young for the never-attempted branch, or already null and fine
  // (a claim is running right now). Return 409 in that case.
  const cutoff = new Date(Date.now() - RETRY_COOLDOWN_MS)
  const neverAttemptedCutoff = new Date(Date.now() - NEVER_ATTEMPTED_MIN_AGE_MS)
  const reset = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      OR: [
        { deliveredAt: null, deliveryError: { not: null } },
        { deliveredAt: { lt: cutoff } },
        { deliveredAt: null, deliveryError: null, createdAt: { lt: neverAttemptedCutoff } },
      ],
    },
    data: {
      deliveredAt: null,
      deliveryError: null,
    },
  })

  if (reset.count === 0) {
    return NextResponse.json(
      {
        error:
          'Delivery was attempted too recently to safely retry. Wait 30 seconds and try again.',
        currentState: {
          deliveredAt: booking.deliveredAt,
          deliveryError: booking.deliveryError,
        },
      },
      { status: 409 }
    )
  }

  // Fire the redelivery via after() - Vercel can freeze the runtime the
  // moment this response is sent, killing a bare un-awaited call before
  // it finishes (discovered this affecting push notifications; the same
  // risk applies here to ticket email/PDF delivery). after() guarantees
  // completion without adding latency to this response.
  after(() => deliverTicket(bookingId))

  return NextResponse.json({
    ok: true,
    bookingId,
    note: 'Redelivery started. Check Booking.deliveredAt / deliveryError in ~30s to see the outcome.',
    previousError: booking.deliveryError,
  })
}
