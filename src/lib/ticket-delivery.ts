import prisma from "@/lib/prisma"
import { generateTicketPdf, TicketData } from "@/lib/ticket-pdf"
import { sendTicketEmail } from "@/lib/email"

// ---------------------------------------------------------------------------
// Ticket delivery orchestrator.
//
// Single-flight semantics: this is called from both /api/bookings/[id]/confirm
// (browser HMAC path) and /api/payments/webhook (server-to-server path).
// Both may fire for the same booking — deliberately, that's the belt-and-
// suspenders design — but the audience must only receive ONE email.
//
// Concurrency control: we claim delivery by setting `Payment.deliveredAt`
// atomically via a conditional update (`WHERE deliveredAt IS NULL`). If
// the update affects 0 rows, someone else already claimed it and we bail.
// If it affects 1 row, we own the delivery attempt. This works even if
// both the confirm endpoint and the webhook fire within the same second.
//
// Delivery is non-blocking to the caller. The confirm endpoint returns
// success to the user the moment the DB transaction commits — waiting
// for Resend to accept the email would tie the "You're in!" screen to
// third-party latency, and worse, could roll back the confirmation on
// a transient delivery error (which would be wrong — the user paid).
//
// Errors are captured to `Payment.deliveryError` so an admin retry
// endpoint (future work, not this checkpoint) can act on them.
// ---------------------------------------------------------------------------

/**
 * Attempts to deliver the ticket for a booking. Idempotent: safe to call
 * multiple times; second call short-circuits on the deliveredAt claim.
 *
 * NEVER throws. Deliberately swallows errors after logging them — the
 * caller's control flow (transitioning a booking to CONFIRMED) is
 * durable and must not be affected by delivery outcomes.
 */
export async function deliverTicket(bookingId: string): Promise<void> {
  try {
    // Claim delivery. updateMany because update() would throw on 0
    // rows; we want the graceful "someone else has it" branch.
    const claim = await prisma.payment.updateMany({
      where: {
        bookingId,
        deliveredAt: null,
      },
      data: {
        deliveredAt: new Date(),
      },
    })
    if (claim.count === 0) {
      // Someone else beat us to it (or the booking has no Payment row —
      // e.g. free events, which don't need a ticket email either).
      return
    }

    // Load the booking + user + event for the email/PDF.
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        event: { include: { venue: true } },
      },
    })
    if (!booking) {
      await recordFailure(bookingId, "Booking disappeared between claim and read")
      return
    }
    if (!booking.user?.email) {
      await recordFailure(bookingId, "User has no email address on file")
      return
    }

    const ticketData: TicketData = {
      bookingId: booking.id,
      eventTitle: booking.event.title,
      eventDate: booking.event.date,
      eventStartTime: booking.event.startTime,
      eventEndTime: booking.event.endTime,
      venueName: booking.event.venue?.name ?? null,
      venueCity: booking.event.venue?.city ?? null,
      seats: (booking.seats as Record<string, number>) ?? {},
      totalAmount: booking.totalAmount,
      attendeeName: booking.user.name ?? "Guest",
      purchasedAt: booking.createdAt,
    }

    let pdfBytes: Uint8Array
    try {
      pdfBytes = await generateTicketPdf(ticketData)
    } catch (err) {
      await recordFailure(
        bookingId,
        `PDF generation failed: ${(err as Error).message}`
      )
      return
    }

    try {
      await sendTicketEmail({
        to: booking.user.email,
        attendeeName: ticketData.attendeeName,
        eventTitle: ticketData.eventTitle,
        eventDateHuman: formatDateHuman(
          ticketData.eventDate,
          ticketData.eventStartTime
        ),
        venueLine: ticketData.venueName
          ? ticketData.venueCity
            ? `${ticketData.venueName}, ${ticketData.venueCity}`
            : ticketData.venueName
          : null,
        seatsSummary:
          Object.entries(ticketData.seats)
            .filter(([, q]) => Number(q) > 0)
            .map(([s, q]) => `${s} × ${q}`)
            .join(", ") || "General admission",
        totalAmount: ticketData.totalAmount,
        bookingId: ticketData.bookingId,
        ticketPdf: pdfBytes,
      })
    } catch (err) {
      await recordFailure(
        bookingId,
        `Email send failed: ${(err as Error).message}`
      )
      return
    }
    // Success — deliveredAt is already set from the claim; nothing to update.
  } catch (err) {
    // Absolute last-resort — never propagate to caller.
    console.error("[deliverTicket] Unexpected error for", bookingId, err)
    try {
      await recordFailure(
        bookingId,
        `Unexpected error: ${(err as Error).message}`
      )
    } catch {
      /* nothing left to try */
    }
  }
}

// Called after a failed delivery attempt. We keep the deliveredAt claim
// set so we don't accidentally re-send on the next webhook retry — the
// retry pathway lives in an admin endpoint (later), which explicitly
// clears deliveredAt before calling deliverTicket() again.
async function recordFailure(bookingId: string, reason: string): Promise<void> {
  console.error("[deliverTicket] Failure for", bookingId, "→", reason)
  await prisma.payment
    .updateMany({
      where: { bookingId },
      data: { deliveryError: reason.slice(0, 500) },
    })
    .catch(() => {
      /* Payment may not exist for free events; that's fine */
    })
}

function formatDateHuman(d: Date, startTime: string): string {
  return `${d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })} at ${startTime}`
}
