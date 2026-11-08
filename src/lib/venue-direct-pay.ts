// D2 (Hitesh, 8 Nov) - Organiser -> Venue owner bookings with DIRECT payment.
// AFA never touches the money:
//   Request -> owner accepts (shows their UPI + amount) -> organiser pays
//   directly and taps "I've paid" (+ optional reference) -> owner confirms
//   receipt -> CONFIRMED. Either side may cancel before confirm; every
//   waiting step expires after 48 h and releases the slot.
//
// Pure helpers only (no Prisma import) so unit self-tests and client
// components can use them. The online (Razorpay) venue path is untouched:
// when the paid-bookings switch is ON and the owner did not choose direct,
// accept behaves exactly as before.

export type DirectPayStatus = 'AWAITING_PAYMENT' | 'PAID_MARKED' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED'
export type DirectPaySide = 'ORGANISER' | 'VENUE_OWNER'
export type DirectPayAction = 'markPaid' | 'confirmReceived' | 'cancel'

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

/**
 * The state machine. Who may do what, from which step:
 *   markPaid        ORGANISER    AWAITING_PAYMENT -> PAID_MARKED (window restarts)
 *   confirmReceived VENUE_OWNER  AWAITING_PAYMENT | PAID_MARKED -> CONFIRMED
 *                                (cash handed over before the organiser taps counts)
 *   cancel          either       AWAITING_PAYMENT | PAID_MARKED -> CANCELLED
 */
export function directPayTransition(
  current: string | null | undefined,
  action: DirectPayAction,
  side: DirectPaySide
): { ok: true; next: DirectPayStatus } | { ok: false; status: 400 | 403; error: string } {
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
