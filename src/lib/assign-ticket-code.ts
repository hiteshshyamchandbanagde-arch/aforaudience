import prisma from '@/lib/prisma'
import { generateTicketCode } from '@/lib/ticket-code'

// BUG-2609-053 - gives a CONFIRMED booking its ticket reference, once.
// Called right after every PENDING -> CONFIRMED transition (free
// auto-confirm, browser payment confirm, Razorpay webhook, +1 booking)
// and again by deliverTicket / the PDF download as a safety net for any
// row confirmed before this existed.
//
// Idempotent and race-safe: the write is `WHERE ticketCode IS NULL`, so
// when the browser confirm and the webhook land together only the first
// code sticks and both callers read back the same value. A unique-index
// collision (P2002) just rolls a new code. Never throws - a missing
// reference must not undo a confirmation the customer has paid for.
export async function ensureTicketCode(bookingId: string): Promise<string | null> {
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await prisma.booking.findUnique({ where: { id: bookingId }, select: { ticketCode: true } })
      if (!existing) return null
      if (existing.ticketCode) return existing.ticketCode
      const code = generateTicketCode()
      try {
        const res = await prisma.booking.updateMany({ where: { id: bookingId, ticketCode: null }, data: { ticketCode: code } })
        if (res.count === 1) return code
        // count 0: a concurrent caller set it first; loop re-reads theirs.
      } catch (err) {
        if ((err as { code?: string })?.code !== 'P2002') throw err
      }
    }
    console.error(`[ticket-code] gave up assigning a code for booking ${bookingId}`)
    return null
  } catch (err) {
    console.error('[ticket-code] assign failed', err)
    return null
  }
}
