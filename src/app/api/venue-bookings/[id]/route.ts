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

    const booking = await prisma.venueBooking.findUnique({ where: { id }, include: { venue: true } })
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

    const updated = await prisma.venueBooking.update({ where: { id }, data: { status } })

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
