import prisma from "@/lib/prisma"
import { generateTicketPdf, TicketData } from "@/lib/ticket-pdf"
import { sendTicketEmail } from "@/lib/email"
import { sendPushToUser } from "@/lib/push"

// ---------------------------------------------------------------------------
// Ticket delivery orchestrator.
//
// Single-flight semantics: this is called from three paths:
//   1. /api/bookings/[id]/confirm       — browser HMAC verify (paid)
//   2. /api/payments/webhook            — server-to-server webhook (paid)
//   3. /api/bookings           (POST)   — free event auto-confirm
//
// Paths 1 and 2 may fire for the same booking within the same second —
// deliberately, that's the belt-and-suspenders design — but the audience
// must only receive ONE email. Path 3 is single-caller (no webhook for
// free events) but still uses the same claim for consistency and to be
// robust if the endpoint is ever retried.
//
// Concurrency control: we claim delivery by setting `Booking.deliveredAt`
// atomically via a conditional update (`WHERE deliveredAt IS NULL`). If
// the update affects 0 rows, someone else already claimed it and we bail.
// If it affects 1 row, we own the delivery attempt.
//
// The claim lives on Booking (not Payment) so free events — which have
// no Payment row at all — participate in the same guarantee. Previously
// the claim was on Payment.updateMany, which silently no-op'd for free
// events. See Master Design Doc §9.2 / EPIC M for the history.
//
// Delivery is non-blocking to the caller. The confirm endpoint returns
// success to the user the moment the DB transaction commits — waiting
// for Resend to accept the email would tie the "You're in!" screen to
// third-party latency, and worse, could roll back the confirmation on
// a transient delivery error (which would be wrong — the user paid).
//
// Errors are captured to `Booking.deliveryError` so an admin retry
// endpoint (future work) can act on them.
// ---------------------------------------------------------------------------

/**
 * Attempts to deliver the ticket for a booking. Idempotent: safe to call
 * multiple times; second call short-circuits on the deliveredAt claim.
 *
 * Works for both paid and free events — the claim is on Booking, not
 * Payment, so absence of a Payment row does not skip delivery.
 *
 * NEVER throws. Deliberately swallows errors after logging them — the
 * caller's control flow (transitioning a booking to CONFIRMED) is
 * durable and must not be affected by delivery outcomes.
 */
export async function deliverTicket(bookingId: string): Promise<void> {
  try {
    // Claim delivery. updateMany because update() would throw on 0
    // rows; we want the graceful "someone else has it" branch.
    const claim = await prisma.booking.updateMany({
      where: {
        id: bookingId,
        deliveredAt: null,
      },
      data: {
        deliveredAt: new Date(),
      },
    })
    if (claim.count === 0) {
      // Someone else beat us to it, or the booking doesn't exist.
      // Either way we're done.
      return
    }

    // Load the booking + user + event for the email/PDF.
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        event: { include: { venue: true, organiser: true } },
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

    // Organiser milestone notifications - awaited (not fire-and-forget)
    // so deliverTicket's own returned promise doesn't resolve before this
    // finishes. Callers now wrap the whole deliverTicket(...) call in
    // after(), which only guarantees completion of what this function's
    // promise actually waits for - an un-awaited call in here would
    // silently reintroduce the exact bug this was built to fix, just one
    // level deeper. Never a push per ticket sold (would spam a popular
    // event); only first sale / 50% / sold-out, and only the single
    // highest threshold this booking just crossed.
    await notifySalesMilestone(
      booking.eventId,
      booking.event.organiser.userId,
      booking.event.totalSeats,
      booking.seats as Record<string, number>
    ).catch((err) => console.error('[push] sales-milestone notify failed', err))

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
      subtotalAmount: booking.subtotalAmount,
      bookingFeeAmount: booking.bookingFeeAmount,
      attendeeName: booking.user.displayName ?? booking.user.name ?? "Guest",
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
        subtotalAmount: ticketData.subtotalAmount,
        bookingFeeAmount: ticketData.bookingFeeAmount,
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
  await prisma.booking
    .update({
      where: { id: bookingId },
      data: { deliveryError: reason.slice(0, 500) },
    })
    .catch(() => {
      /* nothing left to try */
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

/**
 * Sales milestone push for the Organiser: first sale / 50% / sold out.
 * "Sold" is the sum of seats across CONFIRMED bookings, same computation
 * as the sales dashboard (src/app/api/events/[id]/sales/route.ts) - NOT
 * Event.availableSeats, which is never actually decremented anywhere in
 * this codebase.
 *
 * Deterministic without needing new schema state: compute the total sold
 * INCLUDING this booking (newSold), subtract this booking's own seat
 * count to get what it was BEFORE (previousSold), then check which
 * threshold newSold crossed that previousSold hadn't already crossed.
 * Only the highest one fires, so a bulk booking that jumps straight to
 * sold-out doesn't also fire "first sale".
 */
async function notifySalesMilestone(
  eventId: string,
  organiserUserId: string,
  totalSeats: number,
  thisBookingSeats: Record<string, number>
): Promise<void> {
  if (!totalSeats || totalSeats <= 0) return

  const confirmedBookings = await prisma.booking.findMany({
    where: { eventId, status: "CONFIRMED" },
    select: { seats: true },
  })
  const newSold = confirmedBookings.reduce((sum, b) => {
    const seats = (b.seats as Record<string, number>) || {}
    return sum + Object.values(seats).reduce((s, qty) => s + Number(qty), 0)
  }, 0)
  const thisCount = Object.values(thisBookingSeats || {}).reduce((s, qty) => s + Number(qty), 0)
  const previousSold = newSold - thisCount

  const half = totalSeats / 2

  if (previousSold < totalSeats && newSold >= totalSeats) {
    await sendPushToUser(organiserUserId, {
      title: "Sold out! 🎉",
      body: "Your event is completely sold out.",
      url: `/dashboard/organiser/events/${eventId}`,
    })
  } else if (previousSold < half && newSold >= half) {
    await sendPushToUser(organiserUserId, {
      title: "Halfway there",
      body: "Your event has sold 50% of its seats.",
      url: `/dashboard/organiser/events/${eventId}`,
    })
  } else if (previousSold === 0 && newSold > 0) {
    await sendPushToUser(organiserUserId, {
      title: "First ticket sold!",
      body: "Someone just booked a ticket to your event.",
      url: `/dashboard/organiser/events/${eventId}`,
    })
  }
}
