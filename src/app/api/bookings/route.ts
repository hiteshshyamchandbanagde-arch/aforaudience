import { NextResponse, after } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  createRazorpayOrder,
  razorpayCredentialsPresent,
} from '@/lib/razorpay'
import { getPlatformSettings } from '@/lib/platform-settings'
import { deliverTicket } from '@/lib/ticket-delivery'

// PENDING bookings expire after this window if payment doesn't complete.
// Keeps abandoned checkouts from permanently eating capacity. 15 minutes
// is enough time for a slow first-time UPI payment plus a re-attempt on
// failure, without leaving stale reservations around forever.
const PENDING_TTL_MS = 15 * 60 * 1000

// POST /api/bookings — reserves seats and (in QA/anywhere Razorpay is
// configured) creates a Razorpay order for payment.
//
// Two-phase flow: DB transaction claims capacity + creates PENDING
// Booking, then a separate Razorpay call outside the transaction creates
// the order and a Payment row. This keeps the (fast, deterministic) DB
// work atomic without blocking on the (slower, external) Razorpay round-
// trip inside a Prisma transaction — Prisma transactions have a ~5s
// default timeout, and a slow Razorpay call could exceed it.
//
// If Razorpay creation fails after the booking is created, the booking
// is immediately marked CANCELLED so seats are released. Orphan Razorpay
// orders are harmless — they just expire on Razorpay's side.
//
// Response shape depends on whether Razorpay is configured:
//   - Configured (QA):   { booking, payment: { orderId, keyId, amount, currency } }
//                        → frontend redirects to /checkout/[bookingId]
//   - Not configured (prod today):   { booking, message }
//                        → frontend shows "reserved, payment coming" state
//
// This means the same endpoint works cleanly on both environments — prod
// keeps the Checkpoint 1 behavior until Razorpay is turned on there.
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
    })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // §9.2 finding: booking with real money and event-day logistics riding
    // on an unreachable phone was a real gap - gate it here, at the one
    // place a ticket actually gets created, rather than at login (browse-
    // first stays intact; verification is only required to *book*, not to
    // look around).
    if (!user.isVerified) {
      return NextResponse.json(
        { error: 'Verify your phone number before booking a ticket.', reason: 'PHONE_NOT_VERIFIED' },
        { status: 403 }
      )
    }

    const { eventId, seats, seatIds, bookingFeeOverride } = await req.json()
    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
    }

    // Load platform fee settings before validating the override below —
    // needed here (not just later at line ~140) because the override's
    // valid range now comes from the admin-configured band, not a
    // hardcoded constant (29 Jul, admin-configurable min/standard/max fee).
    const feeSettings = await getPlatformSettings()

    // Audience-adjustable booking fee (28 Jul, band made admin-configurable
    // 29 Jul). The checkout-adjacent seat picker pre-fills the platform's
    // standard fee but lets the person move it within the admin's
    // min/max band - "the fee is optional/adjustable" needs to be true
    // and provable, not just a UI claim, so this is validated
    // server-side like any other money-bearing input (client-side
    // clamping alone is decorative, see prisma-account-style learnings
    // elsewhere in this codebase). Bad values are rejected, not silently
    // clamped - a silent clamp would mean the person sees one number in
    // the picker and gets charged a different one.
    const minFeeRupees = feeSettings.minAudienceBookingFee / 100
    const maxFeeRupees = feeSettings.maxAudienceBookingFee / 100
    let bookingFeeOverrideRupees: number | null = null
    if (bookingFeeOverride !== undefined && bookingFeeOverride !== null) {
      const n = Number(bookingFeeOverride)
      if (!Number.isFinite(n) || n < minFeeRupees || n > maxFeeRupees) {
        return NextResponse.json(
          { error: `Booking fee must be between ₹${minFeeRupees} and ₹${maxFeeRupees}` },
          { status: 400 }
        )
      }
      bookingFeeOverrideRupees = n
    }

    // §9.4 twenty-fourth amendment - NUMBERED-mode bookings send seatIds
    // instead of a section/qty map. Kept as a fully separate branch below
    // rather than folded into the seats-map shape, so the existing GA
    // path (still 100% of live traffic) is untouched by this addition.
    const isNumberedRequest = Array.isArray(seatIds)

    if (!isNumberedRequest && (!seats || typeof seats !== 'object')) {
      return NextResponse.json(
        { error: 'Missing eventId or seats' },
        { status: 400 }
      )
    }

    if (isNumberedRequest && seatIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one seat' }, { status: 400 })
    }

    const requestedEntries = isNumberedRequest
      ? []
      : (Object.entries(seats).filter(
          ([, qty]) => Number(qty) > 0
        ) as [string, number][])
    if (!isNumberedRequest && requestedEntries.length === 0) {
      return NextResponse.json(
        { error: 'Select at least one seat' },
        { status: 400 }
      )
    }

    const totalRequested = isNumberedRequest
      ? seatIds.length
      : requestedEntries.reduce((sum, [, qty]) => sum + Number(qty), 0)

    // Phase 1 — DB transaction: capacity check + PENDING booking.
    //
    // `expiresAt` is set only when we're actually going to create a
    // Razorpay order below (i.e. Razorpay is configured on this env).
    // If Razorpay isn't configured — as on prod today — we fall back to
    // the Checkpoint 1 "reserve without expiry, email when checkout is
    // live" behavior. Setting an expiry in that case would silently
    // release seats the user still thinks they hold.
    const now = new Date()
    const razorpayReady = razorpayCredentialsPresent()

    // (feeSettings already loaded above, before the override validation —
    // reused here rather than re-queried, per the original note: cheap
    // single-row query, doing it before the transaction keeps the tx pure
    // DB work and avoids the 5s timeout risk if this ever grows to an
    // external call.)

    // K2 — Route split. Captured here (read-only, outside the return
    // value) rather than re-queried after the transaction, so the split
    // decision is made from the exact same event/organiser row the
    // transaction validated against. Only an "activated" linked account is
    // used as a transfer destination - "created" (not yet bank-verified)
    // accounts can't actually receive a settlement yet, so bookings
    // against those organisers fall back to the pre-K2 behavior (full
    // amount stays on the platform account) rather than failing.
    let payoutAccountId: string | null = null

    const booking = await prisma.$transaction(async (tx: any) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        include: { ticketTiers: true, venue: true, organiser: true },
      })
      if (!event || event.status !== 'APPROVED') {
        throw new Error('Event not found or not open for booking')
      }
      if (event.organiser?.razorpayAccountId && event.organiser.razorpayAccountStatus === 'activated') {
        payoutAccountId = event.organiser.razorpayAccountId
      }

      if (totalRequested > event.maxSeatsPerBooking) {
        throw new Error(
          `Max ${event.maxSeatsPerBooking} seats per booking for this event`
        )
      }

      // §9.4 twenty-fourth amendment - NUMBERED path. Kept fully separate
      // from the GA capacity-check/pricing block below rather than
      // unified, since the two modes have genuinely different occupancy
      // models (per-seat rows vs. a tier-count subquery) - forcing one
      // shape onto both would make each harder to read, not easier.
      if (isNumberedRequest) {
        if (!event.venue || event.venue.seatingMode !== 'NUMBERED') {
          throw new Error('This event is not configured for numbered seating')
        }

        const requestedSeats = await tx.seat.findMany({
          where: { id: { in: seatIds }, venueId: event.venueId },
        })
        if (requestedSeats.length !== seatIds.length) {
          throw new Error('One or more selected seats are invalid')
        }

        // Occupancy is scoped to THIS event - the same physical seats
        // are reused across different events at the same venue over time.
        const heldRows = await tx.bookingSeat.findMany({
          where: {
            seatId: { in: seatIds },
            booking: {
              eventId,
              OR: [
                { status: 'CONFIRMED' },
                { status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
              ],
            },
          },
          select: { seatId: true },
        })
        if (heldRows.length > 0) {
          throw new Error('One or more selected seats are no longer available')
        }

        let subtotalAmount = 0
        for (const s of requestedSeats) {
          // Level-aware match (28 Jul) - a same-named zone can legitimately
          // exist on two different venue levels with two different prices
          // (e.g. "General" on Ground vs Balcony). Matching by sectionName
          // alone previously meant .find() returned whichever tier row
          // happened to be first, silently charging the wrong price for
          // one of the two levels once level-scoped pricing existed.
          const tier = event.ticketTiers.find((t: any) => t.sectionName === s.tierLabel && (t.level || '') === (s.level || ''))
          if (!tier) throw new Error(`No pricing configured for section: ${s.tierLabel}${s.level ? ` (${s.level})` : ''}`)
          subtotalAmount += tier.price
        }

        const bookingFeeRupees =
          subtotalAmount > 0
            ? (bookingFeeOverrideRupees !== null ? bookingFeeOverrideRupees : feeSettings.audienceBookingFee / 100)
            : 0
        const totalAmount = subtotalAmount + bookingFeeRupees

        return tx.booking.create({
          data: {
            userId: user.id,
            eventId,
            seats: {},
            subtotalAmount,
            bookingFeeAmount: bookingFeeRupees,
            totalAmount,
            status: 'PENDING',
            expiresAt:
              razorpayReady && totalAmount > 0
                ? new Date(now.getTime() + PENDING_TTL_MS)
                : null,
            bookingSeats: { create: seatIds.map((seatId: string) => ({ seatId })) },
          },
        })
      }

      // Capacity uses only PENDING-not-yet-expired and CONFIRMED bookings.
      // Expired PENDING rows still exist in the DB but no longer hold
      // capacity — they'll be cleaned up by a later sweep, but the
      // capacity check must ignore them immediately so seats become
      // available the moment they expire.
      const existingBookings = await tx.booking.findMany({
        where: {
          eventId,
          OR: [
            { status: 'CONFIRMED' },
            {
              status: 'PENDING',
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
          ],
        },
        select: { seats: true },
      })
      const bookedSoFar: Record<string, number> = {}
      for (const b of existingBookings) {
        const s = b.seats as Record<string, number>
        for (const [section, qty] of Object.entries(s || {})) {
          bookedSoFar[section] = (bookedSoFar[section] || 0) + Number(qty)
        }
      }

      let subtotalAmount = 0

      if (event.ticketTiers.length > 0) {
        for (const [sectionName, qty] of requestedEntries) {
          const tier = event.ticketTiers.find(
            (t: any) => t.sectionName === sectionName
          )
          if (!tier) throw new Error(`Unknown section: ${sectionName}`)
          const already = bookedSoFar[sectionName] || 0
          if (already + Number(qty) > tier.totalSeats) {
            throw new Error(`Not enough seats left in ${sectionName}`)
          }
          subtotalAmount += tier.price * Number(qty)
        }
      } else {
        // Flat-price event, single implicit "General" section.
        const already = bookedSoFar['General'] || 0
        if (already + totalRequested > event.totalSeats) {
          throw new Error('Not enough seats left')
        }
        subtotalAmount = event.isFree
          ? 0
          : (event.ticketPrice || 0) * totalRequested
      }

      // Audience booking fee — only charged on paid bookings. Free
      // events (subtotalAmount === 0) never see a fee, per the About
      // page's "we don't tax the scene" promise applied at the extreme:
      // if the ticket costs nothing, the platform takes nothing.
      // Fee stored in paise on PlatformSettings; convert to rupees here
      // to keep Booking's Float columns consistent. Person-chosen
      // override (validated above) takes priority over the platform
      // default when present — see comment at the top of this handler.
      const bookingFeeRupees =
        subtotalAmount > 0
          ? (bookingFeeOverrideRupees !== null ? bookingFeeOverrideRupees : feeSettings.audienceBookingFee / 100)
          : 0
      const totalAmount = subtotalAmount + bookingFeeRupees

      return tx.booking.create({
        data: {
          userId: user.id,
          eventId,
          seats,
          subtotalAmount,
          bookingFeeAmount: bookingFeeRupees,
          totalAmount,
          status: 'PENDING',
          expiresAt:
            razorpayReady && totalAmount > 0
              ? new Date(now.getTime() + PENDING_TTL_MS)
              : null,
        },
      })
    })

    // Free event — no payment needed. Confirm immediately.
    if (booking.totalAmount === 0) {
      const confirmed = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CONFIRMED', expiresAt: null },
      })
      // Fire ticket delivery via after() — same reasoning as the paid
      // confirm route: the audience response shouldn't block on Resend/
      // PDF generation, but a bare un-awaited call risks Vercel freezing
      // the runtime before delivery (and the milestone push nested
      // inside it) actually completes.
      after(() => deliverTicket(booking.id))
      return NextResponse.json(
        {
          booking: confirmed,
          message: "You're in! Free entry confirmed.",
        },
        { status: 201 }
      )
    }

    // Paid event — Razorpay path if configured, fallback message if not.
    if (!razorpayReady) {
      // Prod today: payment not turned on. Keep the Checkpoint 1
      // behavior — booking is reserved without expiry, we'll email
      // when checkout goes live.
      return NextResponse.json(
        {
          booking,
          message:
            "Seats reserved. Online payment isn't live yet — we'll email you when checkout is ready to complete your booking.",
        },
        { status: 201 }
      )
    }

    // Phase 2 — Razorpay order creation (outside the transaction).
    // amount is stored in PAISE (integer). totalAmount above is in rupees
    // as a float (existing schema convention on Booking), so multiply by
    // 100 and round to be safe against float representation quirks.
    const amountPaise = Math.round(booking.totalAmount * 100)
    // Ticket subtotal only - NOT totalAmount. The booking fee (the
    // difference between the two) is what stays with the platform; it
    // must never be part of the organiser's transfer.
    const organiserSharePaise = Math.round(booking.subtotalAmount * 100)

    try {
      const order = await createRazorpayOrder({
        amount: amountPaise,
        currency: 'INR',
        receiptPrefix: 'bkg',
        notes: {
          bookingId: booking.id,
          userId: user.id.slice(0, 40),
          eventId: eventId.slice(0, 40),
        },
        transfers:
          payoutAccountId && organiserSharePaise > 0
            ? [{ account: payoutAccountId, amount: organiserSharePaise, currency: 'INR' }]
            : undefined,
      })

      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          razorpayOrderId: order.orderId,
          amount: amountPaise,
          currency: order.currency,
          status: 'CREATED',
        },
      })

      return NextResponse.json(
        {
          booking,
          payment: {
            orderId: order.orderId,
            keyId: order.keyId,
            amount: amountPaise,
            currency: order.currency,
          },
        },
        { status: 201 }
      )
    } catch (err) {
      // Razorpay failed after we already reserved seats. Release them
      // immediately by cancelling the booking so we don't hold capacity
      // on an event the user can't actually pay for.
      console.error('[bookings.POST] Razorpay order creation failed:', err)
      await prisma.booking
        .update({ where: { id: booking.id }, data: { status: 'CANCELLED' } })
        .catch(() => {
          // If even the cancel fails, the 15-min TTL will clean up.
        })
      return NextResponse.json(
        {
          error:
            "Couldn't set up payment. Your seats have been released — please try again.",
        },
        { status: 502 }
      )
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to reserve seats'
    console.error('Error creating booking:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
