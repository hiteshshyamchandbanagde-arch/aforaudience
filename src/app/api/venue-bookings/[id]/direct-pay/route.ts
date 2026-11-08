import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'
import {
  type DirectPayAction,
  type DirectPaySide,
  directPayExpiresAt,
  directPayTransition,
  isDirectPayExpired,
  normalisePayerReference,
} from '@/lib/venue-direct-pay'
import { expireDirectPayBookings } from '@/lib/venue-direct-pay.server'

const ACTIONS: readonly DirectPayAction[] = ['markPaid', 'confirmReceived', 'cancel']

/**
 * D2 - the direct-payment steps of a venue booking (AFA never collects):
 *   { action: 'markPaid', reference? }  organiser: "I've paid"     -> PAID_MARKED
 *   { action: 'confirmReceived' }       venue owner: got the money -> CONFIRMED
 *   { action: 'cancel' }                either side, before confirm -> CANCELLED
 * Expired bookings (48 h at any waiting step) are expired lazily here.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string } | undefined)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const action = body?.action as DirectPayAction
    if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    const booking = await prisma.venueBooking.findUnique({
      where: { id },
      include: {
        venue: { include: { owner: { select: { userId: true, isApproved: true } } } },
        organiser: { select: { userId: true, isApproved: true } },
      },
    })
    if (!booking || !booking.directPayStatus) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const isOrganiser = booking.organiser.userId === userId
    const isOwner = booking.venue.owner.userId === userId
    if (!isOrganiser && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    // One person can be on both sides (own venue): the action decides.
    const side: DirectPaySide =
      action === 'markPaid' ? (isOrganiser ? 'ORGANISER' : 'VENUE_OWNER')
      : action === 'confirmReceived' ? (isOwner ? 'VENUE_OWNER' : 'ORGANISER')
      : isOrganiser ? 'ORGANISER' : 'VENUE_OWNER'
    if (side === 'ORGANISER' && !booking.organiser.isApproved) {
      return NextResponse.json({ error: 'Your Organiser account is still pending approval' }, { status: 403 })
    }
    if (side === 'VENUE_OWNER' && !booking.venue.owner.isApproved) {
      return NextResponse.json({ error: 'Your Venue Owner account is still pending approval' }, { status: 403 })
    }

    if (isDirectPayExpired(booking)) {
      await expireDirectPayBookings({ id: booking.id })
      return NextResponse.json({ error: 'This booking expired after 48 hours.', code: 'EXPIRED' }, { status: 400 })
    }

    const t = directPayTransition(booking.directPayStatus, action, side)
    if (!t.ok) return NextResponse.json({ error: t.error }, { status: t.status })

    const now = new Date()
    let data: Parameters<typeof prisma.venueBooking.updateMany>[0]['data']
    if (t.next === 'PAID_MARKED') {
      // A new waiting step: the owner gets a fresh 48 h to confirm.
      data = {
        directPayStatus: 'PAID_MARKED',
        paidMarkedAt: now,
        payerReference: normalisePayerReference(body?.reference),
        expiresAt: directPayExpiresAt(now.getTime()),
      }
    } else if (t.next === 'CONFIRMED') {
      // The slot is only really taken now: same overlap rule as every confirm.
      const conflicting = await prisma.venueBooking.findFirst({
        where: {
          venueId: booking.venueId,
          status: 'CONFIRMED',
          id: { not: booking.id },
          fromDate: { lte: booking.toDate },
          toDate: { gte: booking.fromDate },
        },
      })
      if (conflicting) {
        return NextResponse.json(
          { error: 'This venue already has a confirmed booking that overlaps these dates.' },
          { status: 409 }
        )
      }
      data = { status: 'CONFIRMED', directPayStatus: 'CONFIRMED', confirmedAt: now }
    } else {
      data = { status: 'CANCELLED', directPayStatus: 'CANCELLED' }
    }

    // Guarded on the step we read, so a double tap / race moves it once.
    const res = await prisma.venueBooking.updateMany({
      where: { id: booking.id, directPayStatus: booking.directPayStatus },
      data,
    })
    if (res.count === 0) {
      return NextResponse.json({ error: 'This booking just changed - refresh and try again.' }, { status: 409 })
    }

    // Side effects that used to happen on confirm now happen here.
    if (booking.eventId && t.next === 'CONFIRMED') {
      await prisma.event.updateMany({
        where: { id: booking.eventId, status: 'PENDING_APPROVAL' },
        data: { status: 'APPROVED' },
      })
    }
    if (booking.eventId && t.next === 'CANCELLED') {
      await prisma.event.updateMany({
        where: { id: booking.eventId, status: 'PENDING_APPROVAL' },
        data: { status: 'DRAFT' },
      })
    }

    const otherUserId = side === 'ORGANISER' ? booking.venue.owner.userId : booking.organiser.userId
    const venueName = booking.venue.name
    const push =
      t.next === 'PAID_MARKED'
        ? { title: 'Organiser says they have paid', body: `Check you received ₹${booking.amount} for ${venueName}, then confirm.`, url: '/dashboard/venue/bookings' }
        : t.next === 'CONFIRMED'
          ? { title: 'Venue booking confirmed!', body: `${venueName} confirmed your payment of ₹${booking.amount}.`, url: '/dashboard/venue-requests' }
          : { title: 'Venue booking cancelled', body: `The booking at ${venueName} was cancelled.`, url: side === 'ORGANISER' ? '/dashboard/venue/bookings' : '/dashboard/venue-requests' }
    if (otherUserId !== userId) {
      notifyAfterResponse(() => sendPushToUser(otherUserId, push), `venue-direct-${action}`)
    }

    const updated = await prisma.venueBooking.findUnique({ where: { id: booking.id } })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('Error updating direct-pay venue booking:', err)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
}
