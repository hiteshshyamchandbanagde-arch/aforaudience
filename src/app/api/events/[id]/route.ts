import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { notifyFollowersOfNewEvent } from '@/lib/follow'
import { parseAmount } from '@/lib/money-validation'
import { requireVerifiedPhone } from '@/lib/verification'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const event = await prisma.event.findUnique({
      where: { id },
      include: { venue: true, organiser: { include: { user: { select: { isSuspended: true } } } } },
    })

    // H3 - same suspension gate as the public listing (GET /api/events),
    // applied here too so a direct/bookmarked link doesn't bypass it.
    if (!event || event.status !== 'APPROVED' || event.organiser.user.isSuspended) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json(event)
  } catch (err) {
    console.error('Error fetching event:', err)
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 })
  }
}

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

    const event = await prisma.event.findUnique({ where: { id } })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN') {
      const organiser = await prisma.organiser.findUnique({ where: { id: event.organiserId } })
      if (!organiser || organiser.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (!organiser.isApproved) {
        return NextResponse.json({ error: 'Your Organiser account is still pending approval' }, { status: 403 })
      }
    }

    const body = await req.json()
    const {
      title, description, type, date, startTime, endTime,
      isFree, ticketPrice, totalSeats, dresscode, vibe, surpriseAct, publish, plusOnesRequired,
      defaultCompensationType, defaultFeeAmount, defaultBuyInAmount, ticketTiers,
    } = body

    // §9.2 (26 Jul) - Edit Event previously had no ticketTiers handling at
    // all, meaning a Numbered-venue event's per-section pricing could only
    // ever be set once, at creation - editing it fell back to a plain
    // ticketPrice field that doesn't apply to tiered venues. Same bounds
    // as POST /api/events.
    const MAX_EVENT_SEATS_EDIT = 100_000
    const MAX_TICKET_PRICE_EDIT = 10_000_000
    if (Array.isArray(ticketTiers)) {
      for (const t of ticketTiers) {
        if (!t?.sectionName) continue
        const tierSeats = Number(t.totalSeats)
        const tierPrice = Number(t.price)
        if (Number.isFinite(tierSeats) && (!Number.isInteger(tierSeats) || tierSeats > MAX_EVENT_SEATS_EDIT)) {
          return NextResponse.json({ error: `Each section's seat count must be a whole number up to ${MAX_EVENT_SEATS_EDIT.toLocaleString('en-IN')}.` }, { status: 400 })
        }
        if (Number.isFinite(tierPrice) && tierPrice > MAX_TICKET_PRICE_EDIT) {
          return NextResponse.json({ error: `Price per seat must be at most ₹${MAX_TICKET_PRICE_EDIT.toLocaleString('en-IN')}.` }, { status: 400 })
        }
      }
    }
    const validTiers = Array.isArray(ticketTiers)
      ? ticketTiers.filter((t: any) => t?.sectionName && Number(t.price) >= 0 && Number(t.totalSeats) > 0)
      : []

    // §4.5 suggestion #1: same rule as event creation - an event with a
    // venue can't go fully live until that venue's booking is actually
    // confirmed. Unlike creation, this event may already have a CONFIRMED
    // booking by the time it's edited (the Organiser saved as draft first,
    // the Venue Owner confirmed in the meantime, now they're publishing) -
    // so this checks the real current booking state rather than assuming.
    let resolvedStatus: string | undefined
    if (publish !== undefined) {
      if (publish) {
        const verifyError = requireVerifiedPhone(user, 'publishing this event')
        if (verifyError) return verifyError
      }
      if (!publish) {
        resolvedStatus = 'DRAFT'
      } else if (!event.venueId) {
        return NextResponse.json({ error: 'A venue must be attached before publishing. Save as a draft to continue without one.' }, { status: 400 })
      } else {
        const confirmedBooking = await prisma.venueBooking.findFirst({
          where: { eventId: event.id, venueId: event.venueId, status: 'CONFIRMED' },
        })
        resolvedStatus = confirmedBooking ? 'APPROVED' : 'PENDING_APPROVAL'
      }
    }

    // Validation-gap cluster fix (design.md §9.2, 26 Jul) - same as
    // POST /api/events: Paid-fee had no bound and could be blank at
    // Publish. `publish` here can be undefined (a non-publish-toggling
    // edit) - only enforce "required" when this save is actually
    // publishing, same rule as POST.
    let feeAmountValue: number | null = null
    let buyInAmountValue: number | null = null
    if (defaultCompensationType !== undefined && ['PAID', 'FREE', 'BUY_IN'].includes(defaultCompensationType)) {
      const feeCheck = parseAmount(defaultFeeAmount, {
        label: 'Fee per artist',
        required: publish === true && defaultCompensationType === 'PAID',
        allowZero: true,
      })
      if (!feeCheck.ok) {
        return NextResponse.json({ error: feeCheck.error }, { status: 400 })
      }
      feeAmountValue = feeCheck.value
      const buyInCheck = parseAmount(defaultBuyInAmount, { label: 'Buy-in amount', allowZero: true })
      if (!buyInCheck.ok) {
        return NextResponse.json({ error: buyInCheck.error }, { status: 400 })
      }
      buyInAmountValue = buyInCheck.value
    }

    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(type && { type }),
        ...(date && { date: new Date(date) }),
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        ...(isFree !== undefined && { isFree: Boolean(isFree) }),
        ...(ticketPrice !== undefined && {
          // Kept for backward compat with anything still reading the flat
          // price directly - null once per-section tiers are in play,
          // same convention as POST /api/events (no single price to show).
          ticketPrice: isFree || validTiers.length > 0 ? null : ticketPrice ? parseFloat(ticketPrice) : null,
        }),
        ...(totalSeats && { totalSeats: parseInt(totalSeats) }),
        ...(dresscode !== undefined && { dresscode }),
        ...(vibe !== undefined && { vibe }),
        ...(surpriseAct !== undefined && { surpriseAct: Boolean(surpriseAct) }),
        ...(plusOnesRequired !== undefined && Number(plusOnesRequired) >= 0 && Number(plusOnesRequired) <= 20 && {
          plusOnesRequired: parseInt(plusOnesRequired),
        }),
        ...(defaultCompensationType !== undefined && ['PAID', 'FREE', 'BUY_IN'].includes(defaultCompensationType) && {
          defaultCompensationType,
          defaultFeeAmount: defaultCompensationType === 'PAID' ? feeAmountValue : null,
          defaultBuyInAmount: defaultCompensationType === 'BUY_IN' ? buyInAmountValue : null,
        }),
        ...(resolvedStatus && { status: resolvedStatus }),
        // Full-replace, same semantics as the seat-map builder's PUT and
        // Venue's zone-price save - the client always sends the complete
        // set of currently-priced sections, not a diff. Only touched when
        // the field is actually present in the body (distinguishes "this
        // PATCH doesn't concern pricing at all" from "clear all tiers").
        // Safe to delete+recreate: bookings resolve a tier by sectionName
        // string match at read time (POST /api/bookings), never by
        // TicketTier.id, so existing bookings are unaffected by new ids.
        ...(ticketTiers !== undefined && {
          ticketTiers: {
            deleteMany: {},
            create: validTiers.map((t: any) => ({
              sectionName: String(t.sectionName),
              price: parseFloat(t.price),
              totalSeats: parseInt(t.totalSeats),
            })),
          },
        }),
      },
    })

    // Only a genuine DRAFT/PENDING_APPROVAL -> APPROVED transition counts as
    // "new event" - re-saving an already-live event must not re-notify.
    if (resolvedStatus === 'APPROVED' && event.status !== 'APPROVED') {
      notifyFollowersOfNewEvent('ORGANISER', event.organiserId, updated)
      if (event.venueId) notifyFollowersOfNewEvent('VENUE', event.venueId, updated)
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Error updating event:', err)
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
  }
}
