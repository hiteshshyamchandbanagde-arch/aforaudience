// Shared validation for any organiser/venue-owner-entered ₹ amount:
// venue Offer Amount, Artist "Paid" fee, venue-negotiation counter-offers,
// direct venue-booking amount. One cap and one parser so all of these stay
// in sync instead of drifting into four separate ad-hoc checks (the
// validation-gap cluster - see design.md - was exactly that drift:
// Offer Amount and Paid-fee had no upper bound at all, and the venue-
// negotiation counter-offer only checked `> 0`, which let a value like
// 3.33e90 straight into a CONFIRMED VenueBooking).
//
// Same order of magnitude as MAX_TICKET_PRICE in /api/events - generous but
// real-world, not a business rule.
export const MAX_INR_AMOUNT = 10_000_000 // ₹1 crore

type ParseAmountResult =
  | { ok: true; value: number | null }
  | { ok: false; error: string }

/**
 * Parse and bound-check a ₹ amount coming from the client.
 *
 * - `required: true` -> blank/missing is rejected (use this at Publish/
 *   confirm-style actions; leave `false` for Draft saves where the field
 *   is legitimately still empty).
 * - `allowZero: true` -> 0 is accepted (e.g. an intentionally free venue
 *   slot); otherwise the minimum is ₹1.
 */
export function parseAmount(
  raw: unknown,
  opts: { label: string; required?: boolean; allowZero?: boolean }
): ParseAmountResult {
  const { label, required = false, allowZero = false } = opts
  const isEmpty = raw === undefined || raw === null || raw === ''

  if (isEmpty) {
    if (required) return { ok: false, error: `${label} is required.` }
    return { ok: true, value: null }
  }

  const n = Number(raw)
  if (!Number.isFinite(n)) {
    return { ok: false, error: `${label} must be a valid number.` }
  }
  const min = allowZero ? 0 : 1
  if (n < min) {
    return {
      ok: false,
      error: allowZero ? `${label} can't be negative.` : `${label} must be at least ₹${min}.`,
    }
  }
  if (n > MAX_INR_AMOUNT) {
    return { ok: false, error: `${label} can't exceed ₹${MAX_INR_AMOUNT.toLocaleString('en-IN')}.` }
  }
  return { ok: true, value: n }
}
