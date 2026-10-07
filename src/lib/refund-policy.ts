// Audience ticket cancellation - graduated refund tiers (design.md
// "Refund policy", session 47, 29 Jul - the four-actor framework's
// audience half; Venue/Organiser/Artist tiers are a separate, larger
// build, not touched here).
//
//   >=14 days before show: full amount minus booking fee and taxes
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
//
// BUG-2609-086 - one module for both sides: PATCH /api/bookings/[id]
// refunds with it, and GET /api/bookings/[id] returns its preview so the
// My Tickets confirm sheet shows the exact numbers the refund will use
// (it used to keep a hand-synced copy in the page).
export const TAX_DEDUCTION_PLACEHOLDER = 0

const MS_PER_DAY = 24 * 60 * 60 * 1000

export type RefundTier = 'past' | 'free' | '14plus' | '50pct' | 'under7'

export type RefundPreview = {
  tier: RefundTier
  /** What the person paid, booking fee included. */
  paid: number
  /** What the refund API will send back. */
  refund: number
  /** The booking fee inside `paid`. */
  bookingFee: number
  /** True when the tier keeps the booking fee back (only the 14+ day tier names it). */
  feeWithheld: boolean
}

// Combines Event.date + startTime into a real instant - same pattern
// already used in POST /api/events (backdated-event validation) and
// POST /api/performances/[id]/cancel (artist 24h cutoff).
export function eventStartInstant(date: Date | string, startTime: string): Date {
  const [h, m] = startTime.split(':').map(Number)
  const start = new Date(date)
  start.setHours(h, m, 0, 0)
  return start
}

export function computeRefund(
  booking: { totalAmount: number; bookingFeeAmount: number },
  eventStart: Date,
  now: Date,
): RefundPreview {
  const paid = booking.totalAmount
  const bookingFee = booking.bookingFeeAmount
  const base = { paid, bookingFee, feeWithheld: false }
  const daysBefore = (eventStart.getTime() - now.getTime()) / MS_PER_DAY
  if (daysBefore <= 0) return { ...base, tier: 'past', refund: 0 }
  if (paid <= 0) return { ...base, tier: 'free', refund: 0 }
  if (daysBefore >= 14) {
    const refund = Math.max(0, paid - bookingFee - TAX_DEDUCTION_PLACEHOLDER)
    return { ...base, tier: '14plus', refund, feeWithheld: bookingFee > 0 }
  }
  if (daysBefore >= 7) return { ...base, tier: '50pct', refund: paid * 0.5 }
  return { ...base, tier: 'under7', refund: 0 }
}
