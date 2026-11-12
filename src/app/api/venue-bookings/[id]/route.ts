import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { billableHours, wholeBilledHours } from '@/lib/venue-billing'
import { getPaidBookingsEnabled } from '@/lib/platform-settings'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'
import {
  DIRECT_PAY_PLATFORM_FEE,
  directPayExpiresAt,
  isDirectPayExpired,
  isWaitingDirectPay,
  shouldUseDirectPay,
} from '@/lib/venue-direct-pay'
import { expireDirectPayBookings } from '@/lib/venue-direct-pay.server'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const booking = await prisma.venueBooking.findUnique({
      where: { id },
      include: { venue: { include: { owner: true } }, organiser: { select: { userId: true } } },
    })
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN') {
      const venueOwner = await prisma.venueOwner.findUnique({ where: { id: booking.venue.ownerId } })
      if (!venueOwner || venueOwner.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (!venueOwner.isApproved) {
        return NextResponse.json({ error: 'Your Venue Owner account is still pending approval' }, { status: 403 })
      }
    }

    const { status, paymentMethod, cashOnly } = await req.json()
    if (!['CONFIRMED', 'CANCELLED', 'PENDING'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // D2 - a direct-payment booking moves only through its own steps
    // (/api/venue-bookings/[id]/direct-pay). Here the owner may still
    // cancel it while it waits; anything else is refused.
    if (booking.directPayStatus) {
      if (isDirectPayExpired(booking)) {
        await expireDirectPayBookings({ id: booking.id })
        return NextResponse.json({ error: 'This booking expired after 48 hours.' }, { status: 400 })
      }
      if (!isWaitingDirectPay(booking.directPayStatus)) {
        return NextResponse.json({ error: 'This booking is already settled.' }, { status: 400 })
      }
      if (status !== 'CANCELLED') {
        return NextResponse.json(
          { error: 'Use the payment steps on this booking (confirm payment received).', code: 'DIRECT_PAY' },
          { status: 400 }
        )
      }
      const cancelled = await prisma.venueBooking.update({
        where: { id },
        // 12 Nov - record who cancelled (admins are not a party; nothing was paid, so no refund status).
        data: {
          status: 'CANCELLED',
          directPayStatus: 'CANCELLED',
          cancelledAt: new Date(),
          ...(user.role === 'ADMIN' ? {} : { cancelledBy: 'VENUE_OWNER' as const }),
        },
      })
      if (booking.eventId) {
        await prisma.event.updateMany({
          where: { id: booking.eventId, status: 'PENDING_APPROVAL' },
          data: { status: 'DRAFT' },
        })
      }
      return NextResponse.json(cancelled)
    }

    // D2 - accepting a request while online payments are off (or when the
    // owner chooses direct) does NOT confirm: it waits for the organiser
    // to pay the owner directly. The online path below is unchanged.
    const direct =
      status === 'CONFIRMED' &&
      booking.status === 'PENDING' &&
      shouldUseDirectPay(await getPaidBookingsEnabled(), paymentMethod)
    if (direct && !booking.venue.owner.upiId && cashOnly !== true) {
      return NextResponse.json(
        { error: 'Add your UPI ID in your profile first, or accept as cash only.', code: 'UPI_REQUIRED' },
        { status: 400 }
      )
    }

    // Feedback 0ed1ec74 - confirmed via code inspection there was no
    // overlap enforcement anywhere (this route, the confirm-transition
    // path, or creation) despite the schema supporting date ranges - two
    // different Organisers could both get a CONFIRMED booking for
    // overlapping dates at the same venue. Standard interval-overlap
    // test: two ranges overlap iff each starts before the other ends.
    // Only checked against OTHER already-CONFIRMED bookings - a pending
    // negotiation isn't a real commitment yet, so it shouldn't block a
    // different Organiser's confirm.
    if (status === 'CONFIRMED' && booking.status !== 'CONFIRMED') {
      const conflicting = await prisma.venueBooking.findFirst({
        where: {
          venueId: booking.venueId,
          status: 'CONFIRMED',
          id: { not: booking.id },
          fromDate: { lt: booking.toDate },
          toDate: { gt: booking.fromDate },
        },
      })
      if (conflicting) {
        return NextResponse.json(
          { error: 'This venue already has a confirmed booking that overlaps these dates.' },
          { status: 409 }
        )
      }
    }

    // F6: on the PENDING -> CONFIRMED transition for HOURLY/DAILY venues,
    // snapshot the pricing context onto the booking so future edits to
    // Venue.hourlyRate / Venue.dailyRate can't retroactively change what
    // this confirmed booking was priced at.
    //
    // Idempotent: only writes snapshot fields if they're still null, so
    // re-hitting confirm (or a status flip through PENDING and back)
    // doesn't overwrite the original captured rates.
    //
    // FLEXIBLE venues are intentionally skipped - their booking goes
    // through the VenueBookingRequest negotiation loop, which already
    // sets agreedRateType='FLEXIBLE' and durationHours. There's no
    // published rate to snapshot for FLEXIBLE; `amount` IS the deal.
    const snapshotData: {
      agreedRateType?: 'HOURLY' | 'DAILY'
      durationHours?: number
      durationDays?: number
      snapshotHourlyRate?: number
      snapshotDailyRate?: number
    } = {}

    if (
      status === 'CONFIRMED' &&
      booking.status !== 'CONFIRMED' &&
      booking.agreedRateType === null &&
      (booking.venue.rateType === 'HOURLY' || booking.venue.rateType === 'DAILY')
    ) {
      snapshotData.agreedRateType = booking.venue.rateType
      snapshotData.snapshotHourlyRate = booking.venue.hourlyRate ?? undefined
      snapshotData.snapshotDailyRate = booking.venue.dailyRate ?? undefined

      // Duration comes from the linked Event's startTime/endTime for
      // HOURLY. If there's no linked event (rare edge case), we skip
      // duration rather than fabricating one - `amount` and rate are
      // still captured, which covers the audit case.
      if (booking.eventId) {
        const event = await prisma.event.findUnique({
          where: { id: booking.eventId },
          select: { startTime: true, endTime: true },
        })
        if (event) {
          if (booking.venue.rateType === 'HOURLY') {
            // BUG-2609-083 - the hours the organiser was quoted (half-hours
            // rounded up, venue minimum applied); whole-number column, so a
            // half-hour is recorded rounded up.
            const hire = billableHours(String(event.startTime), String(event.endTime), booking.venue.minDurationHours)
            if (hire) snapshotData.durationHours = wholeBilledHours(hire.billedHours)
          } else {
            // DAILY: fromDate/toDate span. Same-day is 1, multi-day
            // rentals count inclusive days.
            const msPerDay = 24 * 60 * 60 * 1000
            const days = Math.max(
              1,
              Math.round(
                (booking.toDate.getTime() - booking.fromDate.getTime()) / msPerDay
              ) + 1
            )
            snapshotData.durationDays = days
          }
        }
      }
    }

    if (direct) {
      const accepted = await prisma.venueBooking.update({
        where: { id },
        data: {
          ...snapshotData,
          status: 'PENDING',
          paymentMethod: 'DIRECT',
          directPayStatus: 'AWAITING_PAYMENT',
          expiresAt: directPayExpiresAt(),
          platformFeeAmount: DIRECT_PAY_PLATFORM_FEE,
        },
      })
      notifyAfterResponse(
        () =>
          sendPushToUser(booking.organiser.userId, {
            title: 'Venue request accepted - pay the owner',
            body: `${booking.venue.name} accepted. Pay ₹${booking.amount} directly within 48 hours, then tap "I've paid".`,
            url: '/dashboard/venue-requests',
          }),
        'venue-direct-accept'
      )
      return NextResponse.json(accepted)
    }

    const updated = await prisma.venueBooking.update({
      where: { id },
      data: { status, ...snapshotData },
    })

    // Closes the other half of §4.5 suggestion #1: an event was held at
    // PENDING_APPROVAL specifically because this booking wasn't confirmed
    // yet. Now that it is, the event can actually go live without the
    // Organiser needing to come back and manually re-publish.
    if (status === 'CONFIRMED' && booking.eventId) {
      await prisma.event.updateMany({
        where: { id: booking.eventId, status: 'PENDING_APPROVAL' },
        data: { status: 'APPROVED' },
      })
    }

    // Real gap found through testing: if the Venue Owner rejects instead of
    // confirming, the event was previously left stuck at PENDING_APPROVAL
    // forever - nothing ever moved it, and it was never publicly visible
    // (only APPROVED events show), so it just silently died with no signal
    // to the Organiser. Revert it to DRAFT so it's editable again (pick a
    // different venue, or drop the venue and publish without one) rather
    // than stuck in limbo.
    if (status === 'CANCELLED' && booking.eventId) {
      await prisma.event.updateMany({
        where: { id: booking.eventId, status: 'PENDING_APPROVAL' },
        data: { status: 'DRAFT' },
      })
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Error updating venue booking:', err)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
}
