// BUG-2609-073 - which Flexible (negotiated-rate) venue requests are
// waiting on one side of the negotiation. Shared by the sidebar/tab-bar
// badge count (/api/venue-booking-requests/waiting-count) and the
// request's own PATCH route (the 48-hour expiry).

export const FLEX_REQUEST_EXPIRY_HOURS = 48

export type FlexSide = 'ORGANISER' | 'VENUE_OWNER'

type RequestLike = {
  status: string
  // Oldest first, as both callers load them.
  offers: { proposedBy: string; createdAt: Date | string }[]
}

/** True when the last offer is older than the 48-hour response window. */
export function isFlexRequestExpired(req: RequestLike, now: number = Date.now()): boolean {
  const last = req.offers[req.offers.length - 1]
  return !!last && now - new Date(last.createdAt).getTime() > FLEX_REQUEST_EXPIRY_HOURS * 60 * 60 * 1000
}

/**
 * True when `side` is the one who has to act: the request is PENDING, not
 * past its window, and the other side made the last offer. A request with
 * no offer yet was just sent by the Organiser, so it waits on the venue.
 */
export function isFlexRequestWaitingOn(req: RequestLike, side: FlexSide, now: number = Date.now()): boolean {
  if (req.status !== 'PENDING') return false
  if (isFlexRequestExpired(req, now)) return false
  const last = req.offers[req.offers.length - 1]
  if (!last) return side === 'VENUE_OWNER'
  return last.proposedBy !== side
}
