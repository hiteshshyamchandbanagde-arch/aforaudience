import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { verifyPaymentSignature } from '@/lib/razorpay'
import { deliverTicket } from '@/lib/ticket-delivery'

// POST /api/bookings/[id]/confirm
//
// Called by the checkout page immediately after Razorpay Checkout's
// success callback fires. Body:
//   {
//     razorpay_order_id:   string,
//     razorpay_payment_id: string,
//     razorpay_signature:  string,
//   }
//
// What it does:
//   1. Verifies HMAC signature (the only thing that proves Razorpay
//      actually authorized this payment — without this check, anyone
//      could POST a fake success callback and get a free ticket).
//   2. Checks the order_id in the request matches the Payment row's
//      stored razorpayOrderId — prevents mixing up bookings.
//   3. Transitions Booking PENDING → CONFIRMED and Payment CREATED →
//      VERIFIED. Idempotent: safe to call multiple times; second call
//      just returns the current state.
//   4. Handles the "webhook got here first" race — if Payment is
//      already WEBHOOK_CONFIRMED (server-to-server webhook processed
//      before the browser callback ran), we accept and no-op.
//   5. Handles the "already failed" case — if the webhook reported
//      failure, we don't upgrade to VERIFIED just because the browser
//      says success. That would be a MISMATCH.
//
// Deliberately does NOT trigger PDF/SMS/email — those slot in at
// Checkpoint 3, wired to the CONFIRMED transition once we have real
// user-facing outputs to send. For now, confirmation is DB-only.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params

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

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const orderId =
      typeof body?.razorpay_order_id === 'string' ? body.razorpay_order_id : ''
    const paymentId =
      typeof body?.razorpay_payment_id === 'string'
        ? body.razorpay_payment_id
        : ''
    const signature =
      typeof body?.razorpay_signature === 'string' ? body.razorpay_signature : ''

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        {
          error:
            'Missing razorpay_order_id, razorpay_payment_id, or razorpay_signature',
        },
        { status: 400 }
      )
    }

    // Load booking + payment. Do this before signature verification so
    // we can bind the check to a real booking; also lets us short-circuit
    // when there's nothing to confirm.
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    })
    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }
    if (booking.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!booking.payment) {
      return NextResponse.json(
        { error: 'No payment order attached to this booking' },
        { status: 400 }
      )
    }

    // The order_id the browser sent must match the one we created when
    // the booking was reserved. Otherwise the browser could be confirming
    // a different booking's payment against this booking (accidentally
    // via a stale tab, or maliciously).
    if (booking.payment.razorpayOrderId !== orderId) {
      return NextResponse.json(
        { error: 'Payment order ID mismatch' },
        { status: 400 }
      )
    }

    // Idempotency: if we've already fully confirmed via webhook, don't
    // downgrade. Just tell the client all is well.
    if (
      booking.status === 'CONFIRMED' &&
      (booking.payment.status === 'VERIFIED' ||
        booking.payment.status === 'WEBHOOK_CONFIRMED')
    ) {
      return NextResponse.json({
        ok: true,
        alreadyConfirmed: true,
        booking: { id: booking.id, status: booking.status },
      })
    }

    // If webhook already marked FAILED, browser saying success is a
    // MISMATCH — don't quietly overwrite.
    if (booking.payment.status === 'FAILED') {
      await prisma.payment.update({
        where: { bookingId: booking.id },
        data: { status: 'MISMATCH' },
      })
      return NextResponse.json(
        {
          error:
            'This payment was reported as failed by our payment provider. If you were charged, our team will resolve this — please contact support.',
        },
        { status: 409 }
      )
    }

    // Now the actual security check.
    const verified = verifyPaymentSignature({
      orderId,
      paymentId,
      signature,
    })
    if (!verified) {
      // Deliberately generic — don't leak *why* it failed.
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 400 }
      )
    }

    // Signature good. Transition booking + payment in one transaction.
    const [updatedPayment, updatedBooking] = await prisma.$transaction([
      prisma.payment.update({
        where: { bookingId: booking.id },
        data: {
          razorpayPaymentId: paymentId,
          // If the webhook already ran (WEBHOOK_CONFIRMED), don't
          // downgrade to VERIFIED — leave as WEBHOOK_CONFIRMED, which
          // is the stronger state.
          status:
            booking.payment.status === 'WEBHOOK_CONFIRMED'
              ? 'WEBHOOK_CONFIRMED'
              : 'VERIFIED',
          verifiedAt: booking.payment.verifiedAt ?? new Date(),
        },
      }),
      prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CONFIRMED',
          expiresAt: null,
        },
      }),
    ])

    // Fire ticket delivery in the background. Deliberately not awaited:
    // the user is staring at a spinner right now and Resend can take
    // 300-800ms. The delivery function is idempotent (claims via
    // `deliveredAt IS NULL`) so the webhook can safely retry-trigger
    // if this attempt fails silently. Errors are captured to
    // Booking.deliveryError — the booking stays CONFIRMED either way.
    deliverTicket(booking.id).catch((err) => {
      console.error('[confirm] Background deliverTicket threw:', err)
    })

    return NextResponse.json({
      ok: true,
      booking: { id: updatedBooking.id, status: updatedBooking.status },
      payment: { status: updatedPayment.status },
    })
  } catch (err) {
    console.error('[bookings.confirm] error:', err)
    return NextResponse.json(
      { error: 'Failed to confirm booking' },
      { status: 500 }
    )
  }
}
