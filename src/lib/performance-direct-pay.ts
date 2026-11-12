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
  cancelConfirmedOutcome,
  directPayExpiresAt,
  directPayTransition,
  directRefundTransition,
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
  actor: PerformanceParty,
  ctx?: { eventStart?: Date | string | number | null; now?: number }
): { ok: true; next: DirectPayStatus } | { ok: false; status: 400 | 403; error: string } {
  const dir = performanceDirection(p)
  if (!dir) return { ok: false, status: 400, error: 'Nothing to pay for this performance.' }
  // Map onto D2's roles: payer = ORGANISER, payee = VENUE_OWNER.
  const t = directPayTransition(p.directPayStatus, action, actor === dir.payer ? 'ORGANISER' : 'VENUE_OWNER', {
    fromDate: ctx?.eventStart,
    now: ctx?.now,
  })
  // 12 Nov - cancelConfirmed: either party, CONFIRMED and before the event starts.
  if (action === 'cancelConfirmed') {
    return t.ok ? t : { ...t, error: t.error.replace('booking', 'performance') }
  }
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

/**
 * refundReceived (12 Nov): only the PAYER confirms the refund arrived.
 * PAID -> the organiser; BUY_IN -> the artist. DUE | AS_AGREED -> RECEIVED.
 * Reuses D2's directRefundTransition with the payer mapped onto its
 * ORGANISER side.
 */
export function performanceRefundTransition(
  p: PerformanceTerms & { directRefundStatus: string | null | undefined },
  actor: PerformanceParty
): { ok: true; next: 'RECEIVED' } | { ok: false; status: 400 | 403; error: string } {
  const dir = performanceDirection(p)
  if (!dir) return { ok: false, status: 400, error: 'There is no refund to confirm on this performance.' }
  const t = directRefundTransition(p.directRefundStatus, actor === dir.payer ? 'ORGANISER' : 'VENUE_OWNER')
  if (t.ok) return t
  if (t.status === 403) {
    return { ok: false, status: 403, error: `Only the ${dir.payer === 'ARTIST' ? 'artist' : 'organiser'} can confirm the refund was received.` }
  }
  return { ...t, error: t.error.replace('booking', 'performance') }
}

/**
 * The update for a CONFIRMED direct-pay performance cancelled by `actor`
 * (the direct-pay cancelConfirmed action and the artist's own /cancel
 * share it). Refund outcome from D2's 15-day helper, counted against the
 * event date; "advance paid" = the payee confirmed receipt (confirmedAt).
 * Never sets buyInRefundStatus: AFA holds no direct money to refund.
 */
export function performanceCancelConfirmedData(
  p: { confirmedAt: Date | string | null | undefined },
  eventDate: Date | string | number,
  actor: PerformanceParty,
  now: Date
): {
  cancelledAt: Date
  cancelledBy: PerformanceParty
  directPayStatus: 'CANCELLED'
  directRefundStatus: 'DUE' | 'AS_AGREED' | null
} {
  return {
    cancelledAt: now,
    cancelledBy: actor,
    directPayStatus: 'CANCELLED',
    directRefundStatus: cancelConfirmedOutcome(eventDate, now, p.confirmedAt != null),
  }
}

/** Push body to the other party after a confirmed slot is cancelled (same copy pattern as D2). */
export function performanceCancelledPushBody(
  eventTitle: string,
  amount: number,
  outcome: 'DUE' | 'AS_AGREED' | null,
  days: number
): string {
  if (outcome === 'DUE') {
    return `The confirmed slot at "${eventTitle}" was cancelled. Refund of the ₹${amount} paid is due under the ${days}-day term.`
  }
  if (outcome === 'AS_AGREED') {
    return `The confirmed slot at "${eventTitle}" was cancelled. Cancelled inside ${days} days: any refund is as you both agree.`
  }
  return `The confirmed slot at "${eventTitle}" was cancelled.`
}
