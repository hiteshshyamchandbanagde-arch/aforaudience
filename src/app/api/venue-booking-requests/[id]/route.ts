import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser } from '@/lib/push'

const MAX_OFFERS = 6 // §4.5 suggestion #7 - 3 rounds per side, 6 total
const EXPIRY_HOURS = 48

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const request = await prisma.venueBookingRequest.findUnique({
      where: { id },
      include: {
        venue: { include: { owner: true } },
        organiser: true,
        offers: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Whoever didn't just act needs to know something changed - resolved
    // once here since decline/accept/counter all need it.
    const otherSideUserId = () =>
      callerSide === 'ORGANISER' ? request.venue.owner.userId : request.organiser.userId

    // Work out which side of the negotiation the caller is on.
    let callerSide: 'ORGANISER' | 'VENUE_OWNER' | null = null
    if (user.role === 'ORGANISER') {
      const organiser = await prisma.organiser.findUnique({ where: { userId: user.id } })
      if (organiser?.id === request.organiserId) {
        if (!organiser.isApproved) {
          return NextResponse.json({ error: 'Your Organiser account is still pending approval' }, { status: 403 })
        }
        callerSide = 'ORGANISER'
      }
    } else if (user.role === 'VENUE_OWNER') {
      const venueOwner = await prisma.venueOwner.findUnique({ where: { userId: user.id } })
      if (venueOwner?.id === request.venue.ownerId) {
        if (!venueOwner.isApproved) {
          return NextResponse.json({ error: 'Your Venue Owner account is still pending approval' }, { status: 403 })
        }
        callerSide = 'VENUE_OWNER'
      }
    } else if (user.role === 'ADMIN') {
      callerSide = 'VENUE_OWNER' // admins can act on behalf of a venue owner if needed
    }
    if (!callerSide) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (request.status !== 'PENDING') {
      return NextResponse.json({ error: `This request has already been ${request.status.toLowerCase()}` }, { status: 400 })
    }

    // 48-hour expiry, checked against the most recent offer.
    const lastOffer = request.offers[request.offers.length - 1]
    if (lastOffer && Date.now() - new Date(lastOffer.createdAt).getTime() > EXPIRY_HOURS * 60 * 60 * 1000) {
      await prisma.venueBookingRequest.update({ where: { id }, data: { status: 'EXPIRED' } })
      if (request.eventId) {
        await prisma.event.updateMany({
          where: { id: request.eventId, status: 'PENDING_APPROVAL' },
          data: { status: 'DRAFT' },
        })
      }
      return NextResponse.json({ error: 'This request expired after 48 hours with no response' }, { status: 400 })
    }

    const { action, amount } = await req.json()

    if (action === 'decline') {
      await prisma.venueBookingRequest.update({ where: { id }, data: { status: 'DECLINED' } })
      // Same fix as the direct-booking decline path: don't leave a
      // PENDING_APPROVAL event stuck forever with no venue coming through.
      if (request.eventId) {
        await prisma.event.updateMany({
          where: { id: request.eventId, status: 'PENDING_APPROVAL' },
          data: { status: 'DRAFT' },
        })
      }
      sendPushToUser(otherSideUserId(), {
        title: 'Venue booking request declined',
        body:
          callerSide === 'VENUE_OWNER'
            ? `${request.venue.name} declined your booking request.`
            : `The Organiser withdrew their request for ${request.venue.name}.`,
        url: '/dashboard/venue-requests',
      }).catch((err) => console.error('[push] booking-request-decline notify failed', err))
      return NextResponse.json({ message: 'Declined' })
    }

    if (action === 'accept') {
      if (!lastOffer) {
        return NextResponse.json({ error: 'No offer to accept yet' }, { status: 400 })
      }

      const platformSettings = await prisma.platformSettings.findFirst()

      await prisma.$transaction([
        prisma.venueBookingRequest.update({ where: { id }, data: { status: 'ACCEPTED' } }),
        prisma.venueBooking.create({
          data: {
            venueId: request.venueId,
            organiserId: request.organiserId,
            eventId: request.eventId,
            fromDate: request.requestedDate,
            toDate: request.requestedDate,
            status: 'CONFIRMED',
            amount: lastOffer.amount,
            agreedRateType: 'FLEXIBLE',
            durationHours: request.durationHours,
            platformFeeAmount: platformSettings?.flatVenueBookingFee ?? 199,
          },
        }),
        // Same auto-promote as the direct-booking confirm path: an event
        // held at PENDING_APPROVAL waiting on this negotiation can now
        // actually go live.
        ...(request.eventId
          ? [prisma.event.updateMany({ where: { id: request.eventId, status: 'PENDING_APPROVAL' }, data: { status: 'APPROVED' } })]
          : []),
      ])

      sendPushToUser(otherSideUserId(), {
        title: 'Venue booking confirmed!',
        body: `Your booking at ${request.venue.name} for ₹${lastOffer.amount} is confirmed.`,
        url: '/dashboard/venue-requests',
      }).catch((err) => console.error('[push] booking-request-accept notify failed', err))

      return NextResponse.json({ message: 'Accepted - booking confirmed' })
    }

    if (action === 'counter') {
      if (!amount || Number(amount) <= 0) {
        return NextResponse.json({ error: 'Enter a counter-offer amount' }, { status: 400 })
      }
      if (request.offers.length >= MAX_OFFERS) {
        return NextResponse.json({ error: 'Round limit reached - accept or decline instead' }, { status: 400 })
      }
      // Turn-based: can't counter your own last offer, has to be the other
      // side's turn to respond.
      if (lastOffer && lastOffer.proposedBy === callerSide) {
        return NextResponse.json({ error: "Waiting on the other side to respond" }, { status: 400 })
      }

      await prisma.venueBookingOffer.create({
        data: { requestId: id, proposedBy: callerSide, amount: parseFloat(amount) },
      })

      sendPushToUser(otherSideUserId(), {
        title: 'New counter-offer',
        body: `${request.venue.name} negotiation: counter-offer of ₹${amount}.`,
        url: '/dashboard/venue-requests',
      }).catch((err) => console.error('[push] booking-request-counter notify failed', err))

      return NextResponse.json({ message: 'Counter-offer sent' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Error updating venue booking request:', err)
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 })
  }
}
