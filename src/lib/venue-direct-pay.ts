// D2 (Hitesh, 8 Nov) - Organiser -> Venue owner bookings with DIRECT payment.
// AFA never touches the money:
//   Request -> owner accepts (shows their UPI + amount) -> organiser pays
//   directly and taps "I've paid" (+ optional reference) -> owner confirms
//   receipt -> CONFIRMED. Either side may cancel before confirm; every
//   waiting step expires after 48 h and releases the slot.
//   After CONFIRMED (12 Nov), either side may still cancel before the
//   booked date (cancelConfirmed); AFA records whether the advance is due
//   back under the 15-day standard term, and the organiser (the payer)
//   confirms receipt of any refund (refundReceived).
//
// Pure helpers only (no Prisma import) so unit self-tests and client
// components can use them. The online (Razorpay) venue path is untouched:
// when the paid-bookings switch is ON and the owner did not choose direct,
// accept behaves exactly as before.

export type DirectPayStatus = 'AWAITING_PAYMENT' | 'PAID_MARKED' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED'
export type DirectPaySide = 'ORGANISER' | 'VENUE_OWNER'
export type DirectPayAction = 'markPaid' | 'confirmReceived' | 'cancel' | 'cancelConfirmed' | 'refundReceived'
export type DirectRefundStatus = 'DUE' | 'AS_AGREED' | 'RECEIVED'
type Fail = { ok: false; status: 400 | 403; error: string }

import { DIRECT_PAY_FULL_REFUND_MIN_DAYS } from './direct-pay-terms'

export const DIRECT_PAY_EXPIRY_HOURS = 48
export const DIRECT_PAY_EXPIRY_MS = DIRECT_PAY_EXPIRY_HOURS * 60 * 60 * 1000
/** No AFA platform fee on a direct-payment venue booking. */
export const DIRECT_PAY_PLATFORM_FEE = 0
export const PAYER_REFERENCE_MAX = 100

export const DIRECT_PAY_NO_COLLECT_NOTE = 'AforAudience does not collect or hold this payment.'

/** "Pay <payee> directly. AforAudience does not collect or hold this payment." */
export function directPayNote(payeeName: string): string {
  return `Pay ${payeeName} directly. ${DIRECT_PAY_NO_COLLECT_NOTE}`
}

/**
 * Does an accept create a direct-payment booking? Yes whenever online
 * payments are off, or the owner explicitly chose direct. Otherwise the
 * existing online path runs unchanged.
 */
export function shouldUseDirectPay(paidEnabled: boolean, requested?: unknown): boolean {
  return !paidEnabled || requested === 'DIRECT'
}

export function directPayExpiresAt(now: number = Date.now()): Date {
  return new Date(now + DIRECT_PAY_EXPIRY_MS)
}

export function isWaitingDirectPay(status: string | null | undefined): status is 'AWAITING_PAYMENT' | 'PAID_MARKED' {
  return status === 'AWAITING_PAYMENT' || status === 'PAID_MARKED'
}

/** True when a waiting step has run past its 48-hour window. */
export function isDirectPayExpired(
  b: { directPayStatus: string | null | undefined; expiresAt: Date | string | null | undefined },
  now: number = Date.now()
): boolean {
  if (!isWaitingDirectPay(b.directPayStatus) || !b.expiresAt) return false
  return now > new Date(b.expiresAt).getTime()
}

const DAY_MS = 24 * 60 * 60 * 1000
const IST_OFFSET_MS = 330 * 60 * 1000

/** Whole IST calendar days from `now` to `date` (same IST day = 0; past = negative). */
export function istCalendarDaysUntil(date: Date | string | number, now: Date | string | number = Date.now()): number {
  const day = (v: Date | string | number) => Math.floor((new Date(v).getTime() + IST_OFFSET_MS) / DAY_MS)
  return day(date) - day(now)
}

/**
 * Refund outcome when a CONFIRMED direct-pay booking is cancelled
 * (/refund-policy §3, src/lib/direct-pay-terms.ts):
 *   DUE        an advance was paid and the booked date is
 *              DIRECT_PAY_FULL_REFUND_MIN_DAYS+ IST calendar days away
 *   AS_AGREED  an advance was paid, cancelled inside that window
 *   null       nothing was paid, so there is nothing to refund
 * "Advance paid" = the venue owner confirmed receipt (confirmedAt set,
 * which is what makes a direct booking CONFIRMED). The organiser's
 * "I've paid" tap (paidMarkedAt) alone is only a claim.
 */
export function cancelConfirmedOutcome(
  fromDate: Date | string | number,
  now: Date | string | number,
  advancePaid: boolean
): 'DUE' | 'AS_AGREED' | null {
  if (!advancePaid) return null
  return istCalendarDaysUntil(fromDate, now) >= DIRECT_PAY_FULL_REFUND_MIN_DAYS ? 'DUE' : 'AS_AGREED'
}

/** Has the booked date started (or passed)? Measured in real time against fromDate. */
export function hasBookingStarted(fromDate: Date | string | number, now: Date | string | number = Date.now()): boolean {
  return new Date(now).getTime() >= new Date(fromDate).getTime()
}

/**
 * The state machine. Who may do what, from which step:
 *   markPaid        ORGANISER    AWAITING_PAYMENT -> PAID_MARKED (window restarts)
 *   confirmReceived VENUE_OWNER  AWAITING_PAYMENT | PAID_MARKED -> CONFIRMED
 *                                (cash handed over before the organiser taps counts)
 *   cancel          either       AWAITING_PAYMENT | PAID_MARKED -> CANCELLED
 *   cancelConfirmed either       CONFIRMED -> CANCELLED, only before fromDate
 *                                (needs ctx.fromDate; refused once started)
 * refundReceived is not a step change: see directRefundTransition.
 */
export function directPayTransition(
  current: string | null | undefined,
  action: DirectPayAction,
  side: DirectPaySide,
  ctx?: { fromDate?: Date | string | number | null; now?: number }
): { ok: true; next: DirectPayStatus } | Fail {
  if (action === 'cancelConfirmed') {
    if (current !== 'CONFIRMED') {
      return { ok: false, status: 400, error: 'Only a confirmed booking can be cancelled this way.' }
    }
    if (!ctx?.fromDate || hasBookingStarted(ctx.fromDate, ctx.now ?? Date.now())) {
      return { ok: false, status: 400, error: 'This booking has already started and can no longer be cancelled.' }
    }
    return { ok: true, next: 'CANCELLED' }
  }
  if (action === 'refundReceived') {
    return { ok: false, status: 400, error: 'Invalid action' }
  }
  if (!isWaitingDirectPay(current)) {
    return { ok: false, status: 400, error: 'This booking is no longer waiting on payment.' }
  }
  if (action === 'markPaid') {
    if (side !== 'ORGANISER') return { ok: false, status: 403, error: 'Only the organiser can mark this as paid.' }
    if (current !== 'AWAITING_PAYMENT') return { ok: false, status: 400, error: 'Payment is already marked as sent.' }
    return { ok: true, next: 'PAID_MARKED' }
  }
  if (action === 'confirmReceived') {
    if (side !== 'VENUE_OWNER') return { ok: false, status: 403, error: 'Only the venue owner can confirm payment received.' }
    return { ok: true, next: 'CONFIRMED' }
  }
  if (action === 'cancel') return { ok: true, next: 'CANCELLED' }
  return { ok: false, status: 400, error: 'Invalid action' }
}

/**
 * refundReceived: the ORGANISER (the payer) confirms the refund arrived.
 * DUE | AS_AGREED -> RECEIVED. Anyone else 403; a second tap 400.
 */
export function directRefundTransition(
  current: string | null | undefined,
  side: DirectPaySide
): { ok: true; next: 'RECEIVED' } | Fail {
  if (side !== 'ORGANISER') return { ok: false, status: 403, error: 'Only the organiser can confirm the refund was received.' }
  if (current === 'RECEIVED') return { ok: false, status: 400, error: 'The refund is already marked as received.' }
  if (current !== 'DUE' && current !== 'AS_AGREED') return { ok: false, status: 400, error: 'There is no refund to confirm on this booking.' }
  return { ok: true, next: 'RECEIVED' }
}

/** Optional UPI / cash reference typed by the organiser: trimmed, capped, null when empty. */
export function normalisePayerReference(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().slice(0, PAYER_REFERENCE_MAX)
  return t || null
}

const UPI_RE = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$/

/** Validates a UPI ID (name@bank). Returns the trimmed value, null for empty, or an error. */
export function parseUpiId(v: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (v === undefined || v === null) return { ok: true, value: null }
  if (typeof v !== 'string') return { ok: false, error: 'UPI ID must be text' }
  const t = v.trim()
  if (!t) return { ok: true, value: null }
  if (!UPI_RE.test(t)) return { ok: false, error: 'Enter a valid UPI ID, like name@bank' }
  return { ok: true, value: t }
}

/**
 * D2b - optional UPI QR image (uploaded via the existing image upload,
 * so it is an https URL). Returns the URL, null for empty, or an error.
 * Only https so a QR can never be a javascript:/data: URL.
 */
export function parseUpiQrUrl(v: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (v === undefined || v === null) return { ok: true, value: null }
  if (typeof v !== 'string') return { ok: false, error: 'QR image must be a URL' }
  const t = v.trim()
  if (!t) return { ok: true, value: null }
  if (t.length > 2048) return { ok: false, error: 'QR image URL is too long' }
  try {
    if (new URL(t).protocol !== 'https:') return { ok: false, error: 'QR image must be an https URL' }
  } catch {
    return { ok: false, error: 'QR image must be a URL' }
  }
  return { ok: true, value: t }
}

export type VenueBookingChip =
  | 'requested'
  | 'awaitingPayment'
  | 'paymentMarked'
  | 'confirmed'
  | 'declined'
  | 'expired'
  | 'cancelled'

/** Status chip for a VenueBooking row, owner and organiser views alike. */
export function venueBookingChip(
  b: { status: string; directPayStatus?: string | null; expiresAt?: Date | string | null },
  now: number = Date.now()
): VenueBookingChip {
  const d = b.directPayStatus
  if (d) {
    if (isDirectPayExpired({ directPayStatus: d, expiresAt: b.expiresAt }, now)) return 'expired'
    if (d === 'AWAITING_PAYMENT') return 'awaitingPayment'
    if (d === 'PAID_MARKED') return 'paymentMarked'
    if (d === 'CONFIRMED') return 'confirmed'
    if (d === 'EXPIRED') return 'expired'
    return 'cancelled'
  }
  if (b.status === 'CONFIRMED') return 'confirmed'
  if (b.status === 'CANCELLED' || b.status === 'REFUNDED') return 'declined'
  return 'requested'
}
