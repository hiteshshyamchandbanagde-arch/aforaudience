import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getPublicKeyId, refundPayment } from '@/lib/razorpay'

// GET /api/bookings/[id]
//
// Returns the booking + attached payment info the checkout page needs
// to open Razorpay Checkout. Auth-gated (owner or admin), and includes
// a computed `isExpired` flag so the checkout page can show an "your
// reservation expired" state without duplicating the TTL math.
//
// The publishable Razorpay key ID is echoed in the response so the
// checkout page doesn't need to hit a second endpoint just to open the
// modal. Never returns the secret.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        event: {
          include: {
            venue: true,
            ticketTiers: true,
          },
        },
        payment: true,
        // Numbered-venue bookings store `seats: {}` (empty) by design -
        // the real per-seat picks live here instead. Without this include,
        // the checkout page had no data path to show which seats were
        // booked. See §9.2 "checkout page missing seat/zone breakdown",
        // 22 Jul.
        bookingSeats: { include: { seat: true } },
      },
    })
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (booking.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    const isExpired =
      booking.status === 'PENDING' &&
      booking.expiresAt !== null &&
      booking.expiresAt < now

    // Price resolved by matching (level, Seat.tierLabel) to
    // (TicketTier.level, TicketTier.sectionName) - same rule as
    // GET /api/events/[id]/seats and POST /api/bookings' NUMBERED price
    // resolution (both fixed for this in PR #252). This route was missed
    // in that pass despite its own comment claiming otherwise - found
    // live (28 Jul) testing a venue with same-named zones on two levels
    // at very different prices: the actual charge (booking.subtotalAmount,
    // computed at order-creation time) was correct, but this checkout
    // page showed the WRONG per-seat price for one of the two levels
    // (whichever level's TicketTier row happened to overwrite the other
    // in a name-only Map), and the line items didn't even sum to the
    // page's own Total.
    const priceByTier = new Map(
      booking.event.ticketTiers.map((t: { level: string; sectionName: string; price: number }) => [`${t.level || ''}::${t.sectionName}`, t.price])
    )
    const numberedSeats = booking.bookingSeats.map((bs: { seat: { tierLabel: string; level: string; row: string; number: string } }) => ({
      tierLabel: bs.seat.tierLabel,
      level: bs.seat.level,
      row: bs.seat.row,
      number: bs.seat.number,
      price: priceByTier.get(`${bs.seat.level || ''}::${bs.seat.tierLabel}`) ?? null,
    }))

    return NextResponse.json({
      booking: {
        id: booking.id,
        status: booking.status,
        seats: booking.seats,
        numberedSeats,
        totalAmount: booking.totalAmount,
        subtotalAmount: booking.subtotalAmount,
        bookingFeeAmount: booking.bookingFeeAmount,
        expiresAt: booking.expiresAt,
        isExpired,
        createdAt: booking.createdAt,
        event: {
          id: booking.event.id,
          title: booking.event.title,
          date: booking.event.date,
          startTime: booking.event.startTime,
          endTime: booking.event.endTime,
          venue: booking.event.venue
            ? {
                name: booking.event.venue.name,
                city: booking.event.venue.city,
              }
            : null,
        },
      },
      payment: booking.payment
        ? {
            razorpayOrderId: booking.payment.razorpayOrderId,
            amount: booking.payment.amount,
            currency: booking.payment.currency,
            status: booking.payment.status,
            keyId: getPublicKeyId(),
          }
        : null,
    })
  } catch (err) {
    console.error('Error loading booking:', err)
    return NextResponse.json({ error: 'Failed to load booking' }, { status: 500 })
  }
}

// Combines Event.date + startTime into a real instant - same pattern
// already used in POST /api/events (backdated-event validation) and
// POST /api/performances/[id]/cancel (artist 24h cutoff).
function eventStartInstant(date: Date, startTime: string): Date {
  const [h, m] = startTime.split(':').map(Number)
  const start = new Date(date)
  start.setHours(h, m, 0, 0)
  return start
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Audience ticket cancellation - graduated refund tiers (design.md
// "Refund policy", session 47, 29 Jul - the four-actor framework's
// audience half; Venue/Organiser/Artist tiers are a separate, larger
// build, not touched here).
//
//   >=14 days before show: full amount minus platform fee and taxes
//   7-14 days before show: 50%
//   <7 days before show:   no refund
//
// ASSUMPTION (not explicit in design.md, flagged for Hitesh to
// confirm): the 50% mid-tier is calculated on totalAmount (the full
// amount the audience member paid), matching the plainest reading of
// "50%" with no fee carve-out mentioned for that tier - only the
// >=14-day tier explicitly says "minus platform fee and taxes".
//
// Tax deduction is a placeholder (0) behind the same §9.0 CA-consultation
// gate as everywhere else this pattern appears - the mechanism is real,
// the number isn't decided yet.
const TAX_DEDUCTION_PLACEHOLDER = 0

function computeRefund(booking: { totalAmount: number; bookingFeeAmount: number }, eventStart: Date, now: Date) {
  const daysBefore = (eventStart.getTime() - now.getTime()) / MS_PER_DAY
  if (daysBefore >= 14) {
    const amount = Math.max(0, booking.totalAmount - booking.bookingFeeAmount - TAX_DEDUCTION_PLACEHOLDER)
    return { amount, tier: '>=14 days' as const }
  }
  if (daysBefore >= 7) {
    return { amount: booking.totalAmount * 0.5, tier: '7-14 days' as const }
  }
  return { amount: 0, tier: '<7 days' as const }
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { event: true, payment: true },
    })
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (booking.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // PENDING (unpaid reservation) - unchanged from the original
    // behavior, nothing to refund since nothing was ever charged.
    if (booking.status === 'PENDING') {
      const updated = await prisma.booking.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } })
      return NextResponse.json(updated)
    }

    if (booking.status !== 'CONFIRMED') {
      return NextResponse.json({ error: `Can't cancel a booking that's already ${booking.status.toLowerCase()}` }, { status: 400 })
    }

    const now = new Date()
    const eventStart = eventStartInstant(booking.event.date, booking.event.startTime)
    if (eventStart.getTime() <= now.getTime()) {
      return NextResponse.json({ error: "This event has already happened - it can't be cancelled." }, { status: 400 })
    }

    // Free events (totalAmount 0, no Payment row) - nothing to refund,
    // just release the seat.
    if (booking.totalAmount <= 0 || !booking.payment) {
      const updated = await prisma.booking.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), refundAmount: 0 },
      })
      return NextResponse.json(updated)
    }

    const { amount: refundAmount, tier } = computeRefund(booking, eventStart, now)

    if (refundAmount <= 0) {
      // <7-day tier - real cancellation, genuinely no refund. No
      // Razorpay call needed.
      const updated = await prisma.booking.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), refundAmount: 0 },
      })
      return NextResponse.json(updated)
    }

    if (booking.payment.status !== 'VERIFIED' && booking.payment.status !== 'WEBHOOK_CONFIRMED') {
      return NextResponse.json({ error: 'This booking has no confirmed payment to refund - contact support.' }, { status: 400 })
    }
    if (!booking.payment.razorpayPaymentId) {
      return NextResponse.json({ error: 'No payment record found to refund - contact support.' }, { status: 400 })
    }

    // Double-refund guard: only proceed to the real Razorpay call if
    // this update actually flips a still-CONFIRMED row. A retried or
    // double-clicked request that loses this race gets count:0 and
    // stops here, before ever reaching Razorpay a second time - same
    // guarded-updateMany pattern as the wallet race-condition fix
    // (PR #183). Status is set to REFUNDED optimistically; if the
    // Razorpay call below fails, it's rolled back to CONFIRMED so the
    // booking isn't left in a false "refunded but no money moved" state.
    const claim = await prisma.booking.updateMany({
      where: { id, status: 'CONFIRMED' },
      data: { status: 'REFUNDED', cancelledAt: new Date(), refundAmount },
    })
    if (claim.count === 0) {
      return NextResponse.json({ error: 'This booking was already cancelled.' }, { status: 400 })
    }

    try {
      const refund = await refundPayment({
        razorpayPaymentId: booking.payment.razorpayPaymentId,
        amount: Math.round(refundAmount * 100), // paise, same unit as order creation
        bookingId: booking.id,
        notes: { tier, bookingId: booking.id },
      })
      const updated = await prisma.booking.update({
        where: { id },
        data: { razorpayRefundId: refund.refundId },
      })
      return NextResponse.json(updated)
    } catch (refundErr) {
      console.error('Razorpay refund failed, rolling back booking status:', refundErr)
      await prisma.booking.update({
        where: { id },
        data: { status: 'CONFIRMED', cancelledAt: null, refundAmount: null },
      })
      return NextResponse.json({ error: 'Refund could not be processed right now - please try again or contact support.' }, { status: 502 })
    }
  } catch (err) {
    console.error('Error cancelling booking:', err)
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 })
  }
}
