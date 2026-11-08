// D3 (Hitesh, 8 Nov) - Organiser <-> Artist performance fees with DIRECT
// payment. Same flow as D2's venue bookings, AFA never touches the money:
//   agreed -> payee's UPI/QR + amount shown -> payer pays directly and taps
//   "I've paid" (+ optional reference) -> payee confirms -> CONFIRMED.
//   Either side may cancel/decline before confirm; every waiting step
//   expires after 48 h and releases the lineup slot.
// Two directions, from Performance.compensationType:
//   PAID   - payer ORGANISER, payee ARTIST    (feeAmount)
//   BUY_IN - payer ARTIST,    payee ORGANISER (buyInAmount)
//   FREE   - nothing to pay, never direct-pay.
//
// Pure helpers only (no Prisma import) so unit self-tests and client
// components can use them. Reuses D2's state machine, expiry and chips.
import {
  type DirectPayAction,
  type DirectPayStatus,
  directPayExpiresAt,
  directPayTransition,
  isDirectPayExpired,
  shouldUseDirectPay,
  venueBookingChip,
  type VenueBookingChip,
} from '@/lib/venue-direct-pay'

export type PerformanceParty = 'ORGANISER' | 'ARTIST'

export type PerformanceTerms = {
  compensationType: string | null | undefined
  feeAmount?: number | null
  buyInAmount?: number | null
}

/** Who pays whom, and how much. Null when nothing is owed (FREE, or no positive amount). */
export function performanceDirection(
  p: PerformanceTerms
): { payer: PerformanceParty; payee: PerformanceParty; amount: number } | null {
  if (p.compensationType === 'PAID' && typeof p.feeAmount === 'number' && p.feeAmount > 0) {
    return { payer: 'ORGANISER', payee: 'ARTIST', amount: p.feeAmount }
  }
  if (p.compensationType === 'BUY_IN' && typeof p.buyInAmount === 'number' && p.buyInAmount > 0) {
    return { payer: 'ARTIST', payee: 'ORGANISER', amount: p.buyInAmount }
  }
  return null
}

/**
 * Fields to add to a Performance create so a PAID/BUY_IN slot enters the
 * direct-payment step (48 h). Empty object (= today's behaviour) for FREE,
 * a missing amount, or online payments ON without an explicit DIRECT
 * choice - the Razorpay-switchable path stays untouched.
 */
export function performanceDirectPayCreateData(
  p: PerformanceTerms,
  paidEnabled: boolean,
  requested?: unknown,
  now: number = Date.now()
): { paymentMethod: 'DIRECT'; directPayStatus: 'AWAITING_PAYMENT'; expiresAt: Date } | Record<string, never> {
  if (!performanceDirection(p)) return {}
  if (!shouldUseDirectPay(paidEnabled, requested)) return {}
  return { paymentMethod: 'DIRECT', directPayStatus: 'AWAITING_PAYMENT', expiresAt: directPayExpiresAt(now) }
}

/**
 * The state machine for one performance, with the side resolved from the
 * direction: markPaid = payer only, confirmReceived = payee only, cancel
 * (payer cancels / payee declines) = either. Error messages name the party.
 */
export function performanceDirectPayTransition(
  p: PerformanceTerms & { directPayStatus: string | null | undefined },
  action: DirectPayAction,
  actor: PerformanceParty
): { ok: true; next: DirectPayStatus } | { ok: false; status: 400 | 403; error: string } {
  const dir = performanceDirection(p)
  if (!dir) return { ok: false, status: 400, error: 'Nothing to pay for this performance.' }
  // Map onto D2's roles: payer = ORGANISER, payee = VENUE_OWNER.
  const t = directPayTransition(p.directPayStatus, action, actor === dir.payer ? 'ORGANISER' : 'VENUE_OWNER')
  if (t.ok || t.status !== 403) {
    if (!t.ok && t.error.startsWith('This booking')) return { ...t, error: 'This performance is no longer waiting on payment.' }
    return t
  }
  const name = (x: PerformanceParty) => (x === 'ARTIST' ? 'artist' : 'organiser')
  return action === 'markPaid'
    ? { ok: false, status: 403, error: `Only the ${name(dir.payer)} can mark this as paid.` }
    : { ok: false, status: 403, error: `Only the ${name(dir.payee)} can confirm payment received.` }
}

/** Which side the caller acts as. One user can be both (own event): the action decides. */
export function performanceActor(
  p: PerformanceTerms,
  action: DirectPayAction,
  isOrganiser: boolean,
  isArtist: boolean
): PerformanceParty | null {
  if (!isOrganiser && !isArtist) return null
  if (isOrganiser && !isArtist) return 'ORGANISER'
  if (isArtist && !isOrganiser) return 'ARTIST'
  const dir = performanceDirection(p)
  if (!dir) return 'ORGANISER'
  return action === 'confirmReceived' ? dir.payee : dir.payer
}

export { isDirectPayExpired }

/** Status chip for a direct-pay performance (same chips as D2). */
export function performanceChip(
  p: { directPayStatus?: string | null; expiresAt?: Date | string | null; cancelledAt?: Date | string | null },
  now: number = Date.now()
): VenueBookingChip {
  return venueBookingChip(
    { status: p.cancelledAt ? 'CANCELLED' : 'CONFIRMED', directPayStatus: p.directPayStatus, expiresAt: p.expiresAt },
    now
  )
}
