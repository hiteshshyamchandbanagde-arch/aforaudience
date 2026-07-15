import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

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
      include: { venue: true },
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

    const { status } = await req.json()
    if (!['CONFIRMED', 'CANCELLED', 'PENDING'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
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
            const [sh, sm] = String(event.startTime).split(':').map(Number)
            const [eh, em] = String(event.endTime).split(':').map(Number)
            let mins = (eh * 60 + em) - (sh * 60 + sm)
            if (mins <= 0) mins += 24 * 60
            snapshotData.durationHours = Math.round(mins / 60)
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
