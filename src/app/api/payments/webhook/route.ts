import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  getWebhookSecret,
  verifyWebhookSignature,
} from '@/lib/razorpay'
import { deliverTicket } from '@/lib/ticket-delivery'

// POST /api/payments/webhook
//
// Razorpay's server-to-server webhook. Runs independently of the browser
// callback, and is our safety net for the exact case that matters most:
// the user paid, but their browser closed / tab crashed / network died
// before /confirm ran. Without this, the DB would still show PENDING
// forever for a payment that was actually captured.
//
// Idempotency is critical — Razorpay may deliver the same event more than
// once (retries on transient failures), and the two channels (browser
// confirm + webhook) can arrive in either order. Rules:
//
//   - Signature failed → 401. Reject unauthenticated events.
//   - Order not found in our DB → 200 (accept, log, ignore). Returning
//     4xx would cause Razorpay to keep retrying an event we can't act on.
//   - Payment already WEBHOOK_CONFIRMED (or FAILED) → 200, no-op.
//   - Payment currently CREATED (browser hasn't confirmed yet) →
//     upgrade to WEBHOOK_CONFIRMED, mark booking CONFIRMED.
//   - Payment currently VERIFIED (browser confirmed first) → upgrade
//     to WEBHOOK_CONFIRMED (stronger state).
//   - payment.failed event → mark payment FAILED.
//   - Amount mismatch between webhook and DB → mark MISMATCH, don't
//     auto-confirm. Human review.
//
// Deliberately fails closed (no secret configured → 503) rather than
// silently accepting unsigned events. An unsigned webhook endpoint on
// the public internet is a free ticket generator.
//
// The signature is over the RAW request body — parsing to JSON first
// and re-stringifying changes byte order and breaks the HMAC. So we
// read text() first, then parse.
export const dynamic = 'force-dynamic'

type RazorpayWebhookEvent = {
  event?: string
  payload?: {
    payment?: {
      entity?: {
        id?: string
        order_id?: string
        amount?: number
        currency?: string
        status?: string
        error_description?: string
      }
    }
  }
}

export async function POST(req: Request) {
  try {
    if (!getWebhookSecret()) {
      // Fail closed. Better to loudly break than silently accept.
      console.warn(
        '[webhook] RAZORPAY_WEBHOOK_SECRET is not set; rejecting event'
      )
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 503 }
      )
    }

    const signature = req.headers.get('x-razorpay-signature') ?? ''
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature header' },
        { status: 401 }
      )
    }

    // Read the raw body first — MUST NOT parse and re-stringify.
    const rawBody = await req.text()

    if (!verifyWebhookSignature({ rawBody, signature })) {
      console.warn('[webhook] Invalid signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    let event: RazorpayWebhookEvent
    try {
      event = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const paymentEntity = event.payload?.payment?.entity
    const razorpayOrderId = paymentEntity?.order_id
    const razorpayPaymentId = paymentEntity?.id
    const webhookAmount = paymentEntity?.amount
    const eventType = event.event

    if (!razorpayOrderId || !razorpayPaymentId) {
      // Not a payment event we care about (Razorpay sends other event
      // types too — refunds, disputes, etc.). Accept + no-op so
      // Razorpay doesn't retry.
      return NextResponse.json({ ok: true, ignored: true })
    }

    // Find the Payment row this event refers to.
    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId },
      include: { booking: true },
    })

    if (!payment) {
      // We don't know about this order. Could be a test event from the
      // Razorpay dashboard, or an order created in a different env.
      // Log + 200 so Razorpay stops retrying.
      console.warn(
        `[webhook] Unknown order_id ${razorpayOrderId}; ignoring`
      )
      return NextResponse.json({ ok: true, ignored: 'unknown_order' })
    }

    // Idempotency short-circuits.
    if (
      payment.status === 'WEBHOOK_CONFIRMED' ||
      payment.status === 'FAILED' ||
      payment.status === 'MISMATCH'
    ) {
      // Already handled by an earlier delivery of the same or a related
      // event. Update webhookReceivedAt so we can see retries in the DB
      // if we ever debug, but don't change state.
      await prisma.payment.update({
        where: { id: payment.id },
        data: { webhookReceivedAt: new Date() },
      })
      return NextResponse.json({ ok: true, alreadyHandled: true })
    }

    if (eventType === 'payment.failed') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          razorpayPaymentId,
          failureReason:
            paymentEntity?.error_description ?? 'Reported failed by Razorpay',
          webhookReceivedAt: new Date(),
        },
      })
      // Don't cancel the booking automatically — user might retry with
      // a different card. The 15-minute expiresAt will clean up if not.
      return NextResponse.json({ ok: true, marked: 'FAILED' })
    }

    // Only handle payment.captured (or payment.authorized) as a success
    // signal. Anything else we log + accept but don't act on.
    const isSuccessEvent =
      eventType === 'payment.captured' || eventType === 'payment.authorized'
    if (!isSuccessEvent) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { webhookReceivedAt: new Date() },
      })
      return NextResponse.json({ ok: true, ignored: `unhandled_event:${eventType}` })
    }

    // Amount check — if what Razorpay says was charged doesn't match
    // what we recorded on the Payment row, that's a MISMATCH, not a
    // success. Don't auto-confirm.
    if (typeof webhookAmount === 'number' && webhookAmount !== payment.amount) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'MISMATCH',
          razorpayPaymentId,
          failureReason: `Amount mismatch: webhook=${webhookAmount} db=${payment.amount}`,
          webhookReceivedAt: new Date(),
        },
      })
      console.error(
        `[webhook] Amount mismatch for order ${razorpayOrderId}: webhook=${webhookAmount} db=${payment.amount}`
      )
      return NextResponse.json({ ok: true, marked: 'MISMATCH' }, { status: 200 })
    }

    // Happy path. Two sub-cases depending on browser state.
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'WEBHOOK_CONFIRMED',
          razorpayPaymentId,
          webhookReceivedAt: new Date(),
          // If browser confirmed already, verifiedAt is set; if not,
          // set it now to reflect first-confirmed time.
          verifiedAt: payment.verifiedAt ?? new Date(),
        },
      }),
      prisma.booking.update({
        where: { id: payment.bookingId },
        data: {
          status: 'CONFIRMED',
          expiresAt: null,
        },
      }),
    ])

    // Trigger ticket delivery. Idempotent — if the browser confirm path
    // already fired this, deliverTicket() no-ops on its atomic
    // `deliveredAt IS NULL` claim. Not awaited: Razorpay expects a
    // fast 200 from webhook handlers and will retry on timeout.
    deliverTicket(payment.bookingId).catch((err) => {
      console.error('[webhook] Background deliverTicket threw:', err)
    })

    return NextResponse.json({ ok: true, marked: 'WEBHOOK_CONFIRMED' })
  } catch (err) {
    console.error('[webhook] error:', err)
    // 500 is deliberate — Razorpay will retry, and we want the retry
    // (unlike the "unknown order" case where a retry serves no purpose).
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
