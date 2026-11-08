// D1 (Hitesh, 8 Nov) - "Pay at entry" + attendance tracking.
// Soft launch moves no money through AFA. For a priced show the audience
// reserves on AFA and pays the organiser directly at the venue (cash/UPI).
// AFA never shows its own UPI/QR and never collects.
//
// Pure helpers only (no Prisma import) so unit self-tests and client
// components can use them. The S1a switch (paid-bookings.ts) guards ONLINE
// money only; PAY_AT_ENTRY is never blocked by it.

import { paidBookingBlock, PAID_BOOKINGS_DISABLED, PAID_BOOKINGS_DISABLED_MESSAGE } from './paid-bookings'

export type EventPaymentMode = 'FREE' | 'PAY_AT_ENTRY' | 'ONLINE'
export type AttendanceStatus = 'RESERVED' | 'ATTENDED' | 'NO_SHOW'

export const PAYMENT_MODES: readonly EventPaymentMode[] = ['FREE', 'PAY_AT_ENTRY', 'ONLINE']

/** Server-enforced seat cap for one pay-at-entry booking. */
export const PAY_AT_ENTRY_MAX_SEATS = 4
export const PAY_AT_ENTRY_SEAT_CAP_MESSAGE = `Pay at entry bookings are limited to ${PAY_AT_ENTRY_MAX_SEATS} seats.`

export const AUTO_NO_SHOW_AFTER_END_MS = 24 * 60 * 60 * 1000
export const MARK_NO_SHOW_WINDOW_AFTER_END_MS = 48 * 60 * 60 * 1000

export function isPaymentMode(v: unknown): v is EventPaymentMode {
  return typeof v === 'string' && (PAYMENT_MODES as readonly string[]).includes(v)
}

/**
 * The booking-create matrix. Returns how to handle a booking of
 * `amountPaise` on an event in `mode`, or the 403 block when online money
 * is requested while the switch is off.
 *   FREE / amount 0       -> 'free'
 *   PAY_AT_ENTRY (priced) -> 'atEntry' (never blocked by the switch)
 *   ONLINE (priced)       -> 'online' when ON, 403 when OFF (S1a)
 */
export function bookingPlan(
  mode: EventPaymentMode | null | undefined,
  amountPaise: number,
  paidEnabled: boolean
):
  | { kind: 'free' | 'atEntry' | 'online' }
  | { kind: 'blocked'; status: 403; body: { error: string; code: typeof PAID_BOOKINGS_DISABLED } } {
  if (!(amountPaise > 0)) return { kind: 'free' }
  if (mode === 'PAY_AT_ENTRY') return { kind: 'atEntry' }
  const block = paidBookingBlock(amountPaise, paidEnabled)
  if (block) return { kind: 'blocked', ...block }
  return { kind: 'online' }
}

/** Error text when a pay-at-entry booking asks for too many seats, else null. */
export function payAtEntrySeatCapError(mode: EventPaymentMode | null | undefined, seats: number): string | null {
  if (mode !== 'PAY_AT_ENTRY') return null
  return seats > PAY_AT_ENTRY_MAX_SEATS ? PAY_AT_ENTRY_SEAT_CAP_MESSAGE : null
}

/**
 * Event create/edit: which payment mode to store. `requested` is the body's
 * paymentMode (may be absent); `priced` is whether the body asks for a
 * price > 0. Returns the mode or an error (400/403 body).
 *   - not priced                         -> FREE
 *   - priced, requested PAY_AT_ENTRY     -> PAY_AT_ENTRY (allowed with switch OFF)
 *   - priced, requested ONLINE           -> ONLINE when ON, 403 when OFF
 *   - priced, nothing requested          -> ONLINE when ON (today's behaviour),
 *                                           PAY_AT_ENTRY when OFF
 *   - requested FREE but priced          -> 400
 */
export function resolveEventPaymentMode(
  requested: unknown,
  priced: boolean,
  paidEnabled: boolean
):
  | { ok: true; mode: EventPaymentMode }
  | { ok: false; status: 400 | 403; body: { error: string; code?: string } } {
  if (requested !== undefined && requested !== null && requested !== '' && !isPaymentMode(requested)) {
    return { ok: false, status: 400, body: { error: 'Invalid payment mode' } }
  }
  const req = isPaymentMode(requested) ? requested : null
  if (!priced) {
    if (req === 'PAY_AT_ENTRY' || req === 'ONLINE') {
      return { ok: false, status: 400, body: { error: 'Set a ticket price above ₹0 for a paid show.' } }
    }
    return { ok: true, mode: 'FREE' }
  }
  if (req === 'FREE') {
    return { ok: false, status: 400, body: { error: 'A free event cannot have a ticket price.' } }
  }
  if (req === 'PAY_AT_ENTRY') return { ok: true, mode: 'PAY_AT_ENTRY' }
  if (req === 'ONLINE') {
    if (!paidEnabled) {
      return { ok: false, status: 403, body: { error: PAID_BOOKINGS_DISABLED_MESSAGE, code: PAID_BOOKINGS_DISABLED } }
    }
    return { ok: true, mode: 'ONLINE' }
  }
  return { ok: true, mode: paidEnabled ? 'ONLINE' : 'PAY_AT_ENTRY' }
}

function atTime(date: Date | string, hhmm: string | null | undefined): Date {
  const d = new Date(date)
  const [h, m] = String(hhmm || '00:00').split(':').map(Number)
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0)
  return d
}

/** Event start instant (same date+startTime pattern as POST /api/bookings). */
export function eventStartAt(ev: { date: Date | string; startTime: string }): Date {
  return atTime(ev.date, ev.startTime)
}

/** Event end instant; an endTime at/before startTime runs past midnight. */
export function eventEndAt(ev: { date: Date | string; startTime: string; endTime?: string | null }): Date {
  const start = eventStartAt(ev)
  if (!ev.endTime) return start
  const end = atTime(ev.date, ev.endTime)
  if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1)
  return end
}

/** Organiser "Mark no-show": from event start until 48 h after it ends. */
export function canMarkNoShow(
  ev: { date: Date | string; startTime: string; endTime?: string | null },
  now: Date = new Date()
): boolean {
  const t = now.getTime()
  return t >= eventStartAt(ev).getTime() && t <= eventEndAt(ev).getTime() + MARK_NO_SHOW_WINDOW_AFTER_END_MS
}

/** Auto pass: a CONFIRMED booking still RESERVED 24 h after the event end becomes NO_SHOW. */
export function shouldAutoNoShow(
  booking: { status: string; attendance: AttendanceStatus | string; checkedInAt?: Date | string | null },
  ev: { date: Date | string; startTime: string; endTime?: string | null },
  now: Date = new Date()
): boolean {
  if (booking.status !== 'CONFIRMED') return false
  if (booking.attendance !== 'RESERVED') return false
  if (booking.checkedInAt) return false
  return now.getTime() >= eventEndAt(ev).getTime() + AUTO_NO_SHOW_AFTER_END_MS
}

/** The attendance a booking should show now (lazy auto no-show on read). */
export function effectiveAttendance(
  booking: { status: string; attendance: AttendanceStatus | string; checkedInAt?: Date | string | null },
  ev: { date: Date | string; startTime: string; endTime?: string | null },
  now: Date = new Date()
): AttendanceStatus {
  if (booking.checkedInAt) return 'ATTENDED'
  if (shouldAutoNoShow(booking, ev, now)) return 'NO_SHOW'
  return (booking.attendance as AttendanceStatus) || 'RESERVED'
}

// --- D1b: organiser payment-mode picker (event create/edit) ---

/**
 * The picker's starting choice when an organiser opens Edit Event.
 * The stored mode wins (an ONLINE event stays ONLINE even while the
 * switch is off - never silently converted). Rows without a usable mode
 * fall back on isFree, and a priced row with no mode gets what the
 * server would resolve (ONLINE when the switch is ON, else PAY_AT_ENTRY).
 */
export function initialPickerMode(
  event: { paymentMode?: unknown; isFree?: boolean | null },
  paidEnabled: boolean
): EventPaymentMode {
  if (isPaymentMode(event.paymentMode)) return event.paymentMode
  if (event.isFree !== false) return 'FREE'
  return paidEnabled ? 'ONLINE' : 'PAY_AT_ENTRY'
}

/** The paid mode a priced choice lands on by default (Pay at entry while the switch is off). */
export function defaultPaidPickerMode(paidEnabled: boolean): EventPaymentMode {
  return paidEnabled ? 'ONLINE' : 'PAY_AT_ENTRY'
}

/**
 * How the picker shows its Online payment option.
 *   selectable - the switch is ON
 *   disabled   - OFF: greyed out with "Coming soon"
 *   kept       - OFF, but the event is already ONLINE: stays checked and
 *                visible (with a note) but can't be re-selected once left
 */
export function onlineOptionState(
  paidEnabled: boolean,
  current: EventPaymentMode
): 'selectable' | 'disabled' | 'kept' {
  if (paidEnabled) return 'selectable'
  return current === 'ONLINE' ? 'kept' : 'disabled'
}
