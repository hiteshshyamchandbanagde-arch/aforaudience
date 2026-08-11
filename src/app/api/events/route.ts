import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'
import { requireVerifiedPhone } from '@/lib/verification'
import { parseAmount } from '@/lib/money-validation'
import { notifyFollowersOfNewEvent } from '@/lib/follow'
import { getPlatformSettings } from '@/lib/platform-settings'
import { EVENT_TERMS_CHECKLIST_KEYS, SPECIAL_NOTES_MAX_LENGTH } from '@/lib/event-terms'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const city = searchParams.get('city')?.trim() || null

    const events = await prisma.event.findMany({
      // H3 - a suspended Organiser's future events drop out of public
      // listings immediately (no new tickets sold while suspended), but
      // this deliberately does NOT touch existing confirmed bookings for
      // events already sold - see User.isSuspended comment in schema.
      // Same COMPLETED-status gap as the event detail page (PR #306) -
      // this listing was APPROVED-only, so a completed event vanished
      // from both Upcoming and Past (Past's own date-based split never
      // got a chance to run on it, since it was filtered out before
      // reaching the client). Widen to include COMPLETED; DRAFT/
      // PENDING_APPROVAL/CANCELLED remain excluded.
      // FEAT-2608-036 fast-follow - optional ?city= narrows this at the
      // query level (indexed via Venue_city_idx) instead of the client
      // fetching every event and throwing most of them away. Omitted/
      // null = unchanged "All Cities" behaviour, so this stays backward
      // compatible with any other caller of this route.
      where: {
        status: { in: ['APPROVED', 'COMPLETED'] },
        organiser: { user: { isSuspended: false } },
        ...(city ? { venue: { city } } : {}),
      },
      include: { venue: true, lineup: true },
      orderBy: { date: 'asc' },
    })

    // Event.totalSeats/availableSeats are only kept accurate on the flat/
    // GA booking path - NUMBERED-venue occupancy lives in BookingSeat and
    // was never wired back onto these columns (confirmed live 26 Jul,
    // session 33: a NUMBERED event with 3 CONFIRMED bookings/11 held
    // seats still read availableSeats=totalSeats). Same fix as the event
    // detail page (EventDetailPage, session 33) applied here in batch so
    // the listing cards' Filling Fast/Sold Out badges aren't stale too.
    const numberedEvents = events.filter((e: any) => e.venue?.seatingMode === 'NUMBERED')
    if (numberedEvents.length > 0) {
      const now = new Date()
      const venueIds = [...new Set(numberedEvents.map((e: any) => e.venueId as string))]
      const eventIds = numberedEvents.map((e: any) => e.id as string)

      const [seatCounts, heldRows] = await Promise.all([
        prisma.seat.groupBy({ by: ['venueId'], where: { venueId: { in: venueIds } }, _count: { id: true } }),
        prisma.bookingSeat.findMany({
          where: {
            booking: {
              eventId: { in: eventIds },
              OR: [
                { status: 'CONFIRMED' },
                { status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
              ],
            },
          },
          select: { booking: { select: { eventId: true } } },
        }),
      ])

      const seatTotalByVenue: Record<string, number> = {}
      for (const row of seatCounts) seatTotalByVenue[row.venueId] = row._count.id
      const heldByEvent: Record<string, number> = {}
      for (const row of heldRows) {
        const eid = row.booking.eventId
        heldByEvent[eid] = (heldByEvent[eid] || 0) + 1
      }

      for (const e of numberedEvents) {
        const seatTotal = seatTotalByVenue[e.venueId as string] || 0
        e.totalSeats = seatTotal
        e.availableSeats = Math.max(0, seatTotal - (heldByEvent[e.id as string] || 0))
      }
    }

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
      maxPerformers, applicationApprovalMode, maxSeatsPerBooking, plusOnesRequired,
      defaultCompensationType, defaultFeeAmount, defaultBuyInAmount,
      isCompetitionShow, competitionPrizeFirst, competitionPrizeSecond, competitionPrizeThird,
      termsChecklist, specialNotes,
    } = body

    // Verify-gate only applies at Publish - a Draft isn't a commitment an
    // Organiser plans around yet (see lib/verification.ts doc comment).
    // Body is parsed first so Draft saves for unverified organisers always
    // reach here instead of being rejected before their data is even read.
    if (publish === true) {
      const verifyError = requireVerifiedPhone(user, 'publishing this event')
      if (verifyError) return verifyError
      if (!venueId) {
        return NextResponse.json({ error: 'A venue must be attached before publishing. Save as a draft to continue without one.' }, { status: 400 })
      }
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

    // Validation-gap cluster fix (design.md §9.2, 26 Jul): Offer Amount and
    // Paid-fee previously had no bound at all client- or server-side, and
    // could be submitted blank at Publish - inverting the negotiation flow
    // (venue owner names a price first) and defeating the payment-
    // transparency feature. Required only at Publish, same pattern as
    // requireVerifiedPhone above - a Draft is still a work in progress.
    const bookingAmountCheck = parseAmount(bookingAmount, {
      label: 'Offer Amount',
      required: publish === true && !!venueId,
      allowZero: true,
    })
    if (!bookingAmountCheck.ok) {
      return NextResponse.json({ error: bookingAmountCheck.error }, { status: 400 })
    }
    const feeAmountCheck = parseAmount(defaultFeeAmount, {
      label: 'Fee per artist',
      required: publish === true && defaultCompensationType === 'PAID',
      allowZero: true,
    })
    if (!feeAmountCheck.ok) {
      return NextResponse.json({ error: feeAmountCheck.error }, { status: 400 })
    }
    const buyInAmountCheck = parseAmount(defaultBuyInAmount, {
      label: 'Buy-in amount',
      required: publish === true && defaultCompensationType === 'BUY_IN',
      allowZero: true,
    })
    if (!buyInAmountCheck.ok) {
      return NextResponse.json({ error: buyInAmountCheck.error }, { status: 400 })
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

    // Forward-window cap (Feedback cms9ynuxi, 2 Aug) - organisers can't
    // create an event further out than this without contacting admin.
    // Admin-configurable, default 3 months. Server-side because the
    // create form's date-picker max is trivially bypassed by calling
    // this route directly.
    const { eventCreationWindowMonths } = await getPlatformSettings()
    const maxAllowedDate = new Date()
    maxAllowedDate.setMonth(maxAllowedDate.getMonth() + eventCreationWindowMonths)
    if (eventDate.getTime() > maxAllowedDate.getTime()) {
      return NextResponse.json(
        {
          error: `Events can only be created up to ${eventCreationWindowMonths} months out. For a later date, reach out to the AforAudience team via the feedback/support widget.`,
        },
        { status: 400 }
      )
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

    // Competition show panelists/celebrity: see the note above the
    // isCompetitionShow write below - no longer created/validated here at
    // all as of §8 (Accept-to-Appear, session 57).

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
        // Server-side is the only real enforcement point (client clamp is
        // decorative) - same 0-20 bound as the create form's input.
        plusOnesRequired: plusOnesRequired && Number(plusOnesRequired) >= 0 && Number(plusOnesRequired) <= 20
          ? parseInt(plusOnesRequired)
          : 0,
        // Default artist payment terms, shown to Artists before applying.
        // Server-side validated same as the rest of this route - client
        // clamp/UI is decorative.
        defaultCompensationType: ['PAID', 'FREE', 'BUY_IN'].includes(defaultCompensationType)
          ? defaultCompensationType
          : 'FREE',
        defaultFeeAmount: defaultCompensationType === 'PAID' ? feeAmountCheck.value : null,
        defaultBuyInAmount: defaultCompensationType === 'BUY_IN' ? buyInAmountCheck.value : null,
        // §4.5 suggestion #1, previously unenforced: an event with a venue
        // attached can't go fully live (APPROVED) until that venue's
        // booking is actually confirmed by the Venue Owner - the booking
        // created just below always starts PENDING, so a brand-new event
        // with a venue can never be APPROVED at creation time, regardless
        // of what the Organiser requested. PATCH /api/venue-bookings/[id]
        // auto-promotes it to APPROVED once the Venue Owner confirms.
        // venueId is guaranteed present whenever publish===true (enforced
        // above) - the 'no venue' fallback below is unreachable in practice
        // now, kept only as a defensive default rather than assuming the
        // invariant silently forever.
        status: !publish ? 'DRAFT' : venueId ? 'PENDING_APPROVAL' : 'APPROVED',
        ticketTiers: validTiers.length > 0
          ? {
              create: validTiers.map((t: any) => ({
                sectionName: String(t.sectionName),
                level: String(t.level || ''),
                price: parseFloat(t.price),
                totalSeats: parseInt(t.totalSeats),
              })),
            }
          : undefined,
        // Competition show fields all stay at their false/null defaults
        // unless isCompetitionShow is explicitly true - prize text is
        // meaningless (and hidden in the UI) otherwise, so don't persist
        // stray values from a toggle a user flipped off again.
        //
        // Panelists/celebrity (§8, session 57, Accept-to-Appear) are no
        // longer created here at all - they require a real AFA account
        // lookup + consent handshake (POST /api/events/[id]/panelists/invite,
        // /celebrities/invite), which needs an eventId to exist first.
        // Same "save first" gate that photo uploads already had, just
        // extended to invites themselves now that free-text naming a real
        // person is closed off entirely.
        isCompetitionShow: Boolean(isCompetitionShow),
        competitionPrizeFirst: isCompetitionShow && competitionPrizeFirst ? String(competitionPrizeFirst).trim().slice(0, 200) : null,
        competitionPrizeSecond: isCompetitionShow && competitionPrizeSecond ? String(competitionPrizeSecond).trim().slice(0, 200) : null,
        competitionPrizeThird: isCompetitionShow && competitionPrizeThird ? String(competitionPrizeThird).trim().slice(0, 200) : null,
        // FEAT-2608-045 - termsChecklist filtered against the known key
        // list server-side (never trust client-sent keys directly into an
        // array shown publicly). specialNotes goes to PENDING on
        // creation whenever non-empty - never auto-visible, always needs
        // admin approval first. Empty/missing notes stay at the DB
        // default (NONE) - nothing to review.
        termsChecklist: Array.isArray(termsChecklist)
          ? termsChecklist.filter((k: unknown) => typeof k === 'string' && EVENT_TERMS_CHECKLIST_KEYS.includes(k))
          : [],
        specialNotes: specialNotes ? String(specialNotes).trim().slice(0, SPECIAL_NOTES_MAX_LENGTH) : null,
        specialNotesStatus: specialNotes && String(specialNotes).trim() ? 'PENDING' : 'NONE',
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
        if (bookingAmountCheck.value !== null) {
          await prisma.venueBookingOffer.create({
            data: { requestId: request.id, proposedBy: 'ORGANISER', amount: bookingAmountCheck.value },
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
            amount: bookingAmountCheck.value ?? 0,
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
