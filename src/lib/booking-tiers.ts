// BUG-2610-003 - ticket tier and listing price, resolved at read time.
//
// A numbered-seat booking stores `seats: {}` by design (its picks are
// BookingSeat rows), so the tier lived only on each seat's tierLabel and
// My Tickets showed "—". A tiered event stores its prices in TicketTier
// and leaves Event.ticketPrice null, so its listing card showed "—" too.
// Existing rows are not rewritten: both are derived when read.

/** Tier names for a booking: GA section names with seats, else the booked seats' tiers. */
export function bookingTierNames(seats: Record<string, number> | null | undefined, bookedSeats: { tierLabel: string }[]): string[] {
  const sections = Object.entries(seats || {})
    .filter(([, qty]) => Number(qty) > 0)
    .map(([name]) => name)
  if (sections.length > 0) return sections
  return [...new Set(bookedSeats.map((s) => s.tierLabel).filter(Boolean))]
}

/** The price a listing shows: the event's own ticket price, else its cheapest priced tier. */
export function listingPrice(ticketPrice: number | null | undefined, tiers: { price: number }[]): number | null {
  if (ticketPrice) return ticketPrice
  const prices = tiers.map((t) => t.price).filter((p) => p > 0)
  return prices.length > 0 ? Math.min(...prices) : ticketPrice ?? null
}

/**
 * BUG-2609-079 - an event as a listing card needs it: `ticketPrice` is the
 * listing price above, and `priceFromTiers` says it came from the cheapest
 * tier (the card then reads "From ₹X"). The tier rows themselves are dropped.
 */
export function withListingPrice<E extends { ticketPrice: number | null }>(
  event: E & { ticketTiers?: { price: number }[] },
): Omit<E, 'ticketTiers'> & { ticketPrice: number | null; priceFromTiers: boolean } {
  const { ticketTiers = [], ...rest } = event
  const price = listingPrice(event.ticketPrice, ticketTiers)
  return { ...(rest as Omit<E, 'ticketTiers'>), ticketPrice: price, priceFromTiers: !event.ticketPrice && !!price }
}
