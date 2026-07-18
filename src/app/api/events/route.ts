import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      where: { status: 'APPROVED' },
      include: { venue: true, lineup: true },
      orderBy: { date: 'asc' },
    })
    return NextResponse.json(events)
  } catch (err) {
    console.error('Error fetching events:', err)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user || user.role !== 'ORGANISER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const organiser = await prisma.organiser.findUnique({ where: { userId: user.id } })
    if (!organiser) {
      return NextResponse.json({ error: 'Organiser profile not found' }, { status: 404 })
    }
    if (!organiser.isApproved) {
      return NextResponse.json({ error: 'Your Organiser account is still pending approval' }, { status: 403 })
    }

    const body = await req.json()
    const {
      title, description, type, date, startTime, endTime,
      isFree, ticketPrice, totalSeats, dresscode, vibe, surpriseAct,
      venueId, bookingAmount, publish, ticketTiers,
      maxPerformers, applicationApprovalMode, maxSeatsPerBooking,
    } = body

    if (!title || !description || !type || !date || !startTime || !endTime || !totalSeats) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const seats = parseInt(totalSeats)
    if (!seats || seats < 1) {
      return NextResponse.json({ error: 'Total seats must be at least 1' }, { status: 400 })
    }

    // §4.5 - per-section pricing, when provided. Validated here rather than
    // trusting the client: every tier needs a real section name and a
    // non-negative price/seat count.
    const validTiers = Array.isArray(ticketTiers)
      ? ticketTiers.filter((t: any) => t?.sectionName && Number(t.price) >= 0 && Number(t.totalSeats) > 0)
      : []

    const event = await prisma.event.create({
      data: {
        organiserId: organiser.id,
        venueId: venueId || null,
        title,
        description,
        type,
        date: new Date(date),
        startTime,
        endTime,
        isFree: Boolean(isFree),
        // Kept for backward compat with anything still reading the flat
        // price directly; null when per-section tiers are in play, since
        // there's no single price to show there any more.
        ticketPrice: isFree || validTiers.length > 0 ? null : ticketPrice ? parseFloat(ticketPrice) : null,
        totalSeats: seats,
        availableSeats: seats,
        dresscode: dresscode || null,
        vibe: vibe || null,
        surpriseAct: Boolean(surpriseAct),
        maxPerformers: maxPerformers ? parseInt(maxPerformers) : null,
        applicationApprovalMode: applicationApprovalMode === 'AUTO' ? 'AUTO' : 'MANUAL',
        maxSeatsPerBooking: maxSeatsPerBooking && Number(maxSeatsPerBooking) >= 1 && Number(maxSeatsPerBooking) <= 10
          ? parseInt(maxSeatsPerBooking)
          : 4,
        // §4.5 suggestion #1, previously unenforced: an event with a venue
        // attached can't go fully live (APPROVED) until that venue's
        // booking is actually confirmed by the Venue Owner - the booking
        // created just below always starts PENDING, so a brand-new event
        // with a venue can never be APPROVED at creation time, regardless
        // of what the Organiser requested. PATCH /api/venue-bookings/[id]
        // auto-promotes it to APPROVED once the Venue Owner confirms.
        status: !publish ? 'DRAFT' : venueId ? 'PENDING_APPROVAL' : 'APPROVED',
        ticketTiers: validTiers.length > 0
          ? {
              create: validTiers.map((t: any) => ({
                sectionName: String(t.sectionName),
                price: parseFloat(t.price),
                totalSeats: parseInt(t.totalSeats),
              })),
            }
          : undefined,
      },
    })

    // Booking a venue for this event: Hourly/Daily venues still get a
    // direct booking request (there's a real rate to propose against).
    // Flexible venues have no fixed rate - this now creates an actual
    // VenueBookingRequest + opening VenueBookingOffer instead of a blind
    // VenueBooking, so it can go through the real negotiation loop
    // (PATCH /api/venue-booking-requests/[id]) rather than pretending a
    // single proposed number is a booking.
    if (venueId) {
      const venue = await prisma.venue.findUnique({ where: { id: venueId }, include: { owner: true } })
      if (!venue) {
        return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
      }

      if (venue.rateType === 'FLEXIBLE') {
        const [sh, sm] = String(startTime).split(':').map(Number)
        const [eh, em] = String(endTime).split(':').map(Number)
        let mins = (eh * 60 + em) - (sh * 60 + sm)
        if (mins <= 0) mins += 24 * 60
        const durationHours = Math.round(mins / 60)

        const request = await prisma.venueBookingRequest.create({
          data: {
            organiserId: organiser.id,
            venueId,
            eventId: event.id,
            requestedDate: new Date(date),
            durationHours,
            status: 'PENDING',
          },
        })
        if (bookingAmount) {
          await prisma.venueBookingOffer.create({
            data: { requestId: request.id, proposedBy: 'ORGANISER', amount: parseFloat(bookingAmount) },
          })
        }

        notifyAfterResponse(
          () =>
            sendPushToUser(venue.owner.userId, {
              title: 'New venue booking request',
              body: `${venue.name} has a new booking request for ${new Date(date).toLocaleDateString('en-IN')}.`,
              url: '/dashboard/venue-requests',
            }),
          'venue-booking-request'
        )
      } else {
        const platformSettings = await prisma.platformSettings.findFirst()
        await prisma.venueBooking.create({
          data: {
            venueId,
            organiserId: organiser.id,
            eventId: event.id,
            fromDate: new Date(date),
            toDate: new Date(date),
            status: 'PENDING',
            amount: bookingAmount ? parseFloat(bookingAmount) : 0,
            platformFeeAmount: platformSettings?.flatVenueBookingFee ?? 199,
          },
        })

        notifyAfterResponse(
          () =>
            sendPushToUser(venue.owner.userId, {
              title: 'New venue booking request',
              body: `${venue.name} has a new booking request for ${new Date(date).toLocaleDateString('en-IN')}.`,
              url: '/dashboard/venue-requests',
            }),
          'venue-booking-request'
        )
      }
    }

    return NextResponse.json(event, { status: 201 })
  } catch (err) {
    console.error('Error creating event:', err)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}
