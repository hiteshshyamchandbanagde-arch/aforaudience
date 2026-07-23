import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'
import { requireVerifiedPhone } from '@/lib/verification'
import { notifyFollowersOfNewEvent } from '@/lib/follow'

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      // H3 - a suspended Organiser's future events drop out of public
      // listings immediately (no new tickets sold while suspended), but
      // this deliberately does NOT touch existing confirmed bookings for
      // events already sold - see User.isSuspended comment in schema.
      where: { status: 'APPROVED', organiser: { user: { isSuspended: false } } },
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

    // Verify-gate only applies at Publish - a Draft isn't a commitment an
    // Organiser plans around yet (see lib/verification.ts doc comment).
    // Body is parsed first so Draft saves for unverified organisers always
    // reach here instead of being rejected before their data is even read.
    if (publish === true) {
      const verifyError = requireVerifiedPhone(user, 'publishing this event')
      if (verifyError) return verifyError
    }

    if (!title || !description || !type || !date || !startTime || !endTime || !totalSeats) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const seats = parseInt(totalSeats)
    if (!seats || seats < 1) {
      return NextResponse.json({ error: 'Total seats must be at least 1' }, { status: 400 })
    }
    // Same unbounded-input gap as venue creation (§9.2) - generous but
    // real-world caps, not a business rule.
    const MAX_EVENT_SEATS = 100_000
    const MAX_TICKET_PRICE = 10_000_000 // ₹1 crore
    const MAX_PERFORMERS = 500
    if (seats > MAX_EVENT_SEATS) {
      return NextResponse.json({ error: `Total seats can't exceed ${MAX_EVENT_SEATS.toLocaleString('en-IN')}.` }, { status: 400 })
    }
    if (maxPerformers !== undefined && maxPerformers !== null && maxPerformers !== '') {
      const mp = Number(maxPerformers)
      if (!Number.isFinite(mp) || !Number.isInteger(mp) || mp < 1 || mp > MAX_PERFORMERS) {
        return NextResponse.json({ error: `Max performers must be a whole number between 1 and ${MAX_PERFORMERS}.` }, { status: 400 })
      }
    }
    if (!isFree && ticketPrice !== undefined && ticketPrice !== null && ticketPrice !== '') {
      const price = Number(ticketPrice)
      if (!Number.isFinite(price) || price < 0 || price > MAX_TICKET_PRICE) {
        return NextResponse.json({ error: `Ticket price must be between ₹0 and ₹${MAX_TICKET_PRICE.toLocaleString('en-IN')}.` }, { status: 400 })
      }
    }
    if (Array.isArray(ticketTiers)) {
      for (const t of ticketTiers) {
        if (!t?.sectionName) continue
        const tierSeats = Number(t.totalSeats)
        const tierPrice = Number(t.price)
        if (Number.isFinite(tierSeats) && (!Number.isInteger(tierSeats) || tierSeats > MAX_EVENT_SEATS)) {
          return NextResponse.json({ error: `Each section's seat count must be a whole number up to ${MAX_EVENT_SEATS.toLocaleString('en-IN')}.` }, { status: 400 })
        }
        if (Number.isFinite(tierPrice) && tierPrice > MAX_TICKET_PRICE) {
          return NextResponse.json({ error: `Price per seat must be at most ₹${MAX_TICKET_PRICE.toLocaleString('en-IN')}.` }, { status: 400 })
        }
      }
    }

    // Backdating check. Combine date + startTime into an actual instant and
    // compare to now - a bare `date` check alone would still let someone
    // pick today's date with a startTime that already passed. Client-side
    // datepicker constraints are trivially bypassed by calling this route
    // directly, so this has to be enforced here, not just in the form.
    const startTimeMatch = /^(\d{1,2}):(\d{2})$/.exec(String(startTime))
    if (!startTimeMatch) {
      return NextResponse.json({ error: 'Invalid start time' }, { status: 400 })
    }
    const eventDate = new Date(date)
    if (Number.isNaN(eventDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }
    eventDate.setHours(Number(startTimeMatch[1]), Number(startTimeMatch[2]), 0, 0)
    if (eventDate.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Event date and time must be in the future' }, { status: 400 })
    }
    if (!/^\d{1,2}:\d{2}$/.test(String(endTime))) {
      return NextResponse.json({ error: 'Invalid end time' }, { status: 400 })
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

    // A brand-new event only ever reaches APPROVED at creation time when
    // it has no venue attached (see the status ternary above) - venue
    // events always start PENDING_APPROVAL. Guarding on event.status here
    // rather than assuming keeps this correct if that ternary ever changes.
    if (event.status === 'APPROVED') {
      notifyFollowersOfNewEvent('ORGANISER', organiser.id, event)
      if (venueId) notifyFollowersOfNewEvent('VENUE', venueId, event)
    }

    return NextResponse.json(event, { status: 201 })
  } catch (err) {
    console.error('Error creating event:', err)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}
