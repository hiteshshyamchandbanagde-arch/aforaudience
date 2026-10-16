// Run F (16 Oct 2026) - pure data builders for scripts/qa-seed.ts, kept
// free of Prisma/dotenv/DB so scripts/qa-seed-data.test.ts can run them in
// CI without a database.
//
// Two seed bugs Hitesh found on his phone pass (13-14 Oct):
// - qa-demo-booking-full-atul-1 had `seats: {}` (no tier, no quantity) and a
//   createdAt (seed run time) 4 days AFTER its checkedInAt (event date).
// - Event descriptions were faker.lorem (Latin placeholder).

const DAY_MS = 24 * 60 * 60 * 1000

// Same shape POST /api/bookings stores for a general-admission booking:
// `{ [sectionName]: qty }`, with the flat-price/free event's single implicit
// section named "General" (SeatSelectionClientPage sends selectedSeats.General
// for free events too). Only numbered-venue bookings store `{}`, and those
// carry BookingSeat rows instead - the seed never creates those here.
export function seededGaSeats(qty = 1): Record<string, number> {
  return { General: qty }
}

// A seeded booking is made a few days before the event, and a past one is
// checked in at the event, so createdAt < checkedInAt <= event date always.
export const BOOKED_DAYS_BEFORE_EVENT = 5

export type SeedBookingInput = {
  id: string
  userId: string
  eventId: string
  eventDate: Date
  ticketPrice: number | null
  isPast: boolean
  checkedInByUserId: string | null
  now?: Date
}

export function buildSeedBooking(input: SeedBookingInput) {
  const now = input.now ?? new Date()
  const subtotal = input.ticketPrice ?? 0
  const bookedAt = new Date(input.eventDate.getTime() - BOOKED_DAYS_BEFORE_EVENT * DAY_MS)
  return {
    id: input.id,
    userId: input.userId,
    eventId: input.eventId,
    seats: seededGaSeats(1),
    totalAmount: subtotal,
    subtotalAmount: subtotal,
    bookingFeeAmount: 0,
    status: "CONFIRMED" as const,
    // Never in the future: an upcoming event's booking 5 days out from a
    // show 3 days away would otherwise be dated after the seed ran.
    createdAt: bookedAt.getTime() < now.getTime() ? bookedAt : now,
    checkedInAt: input.isPast ? input.eventDate : null,
    checkedInByUserId: input.isPast ? input.checkedInByUserId : null,
  }
}
