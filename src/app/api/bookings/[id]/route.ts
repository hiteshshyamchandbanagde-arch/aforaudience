import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getPublicKeyId } from '@/lib/razorpay'

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

    return NextResponse.json({
      booking: {
        id: booking.id,
        status: booking.status,
        seats: booking.seats,
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

// Cancel-only for now, not refund - every booking is currently PENDING
// (no payment integration exists yet), so there's nothing to actually
// refund. This just releases the reserved seats back to availability by
// marking the booking CANCELLED, which POST /api/bookings' capacity check
// already excludes (only PENDING/CONFIRMED count against the cap).
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

    const booking = await prisma.booking.findUnique({ where: { id } })
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (booking.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (booking.status !== 'PENDING') {
      return NextResponse.json({ error: `Can't cancel a booking that's already ${booking.status.toLowerCase()}` }, { status: 400 })
    }

    const updated = await prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' } })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('Error cancelling booking:', err)
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 })
  }
}
