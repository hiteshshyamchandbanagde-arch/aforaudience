// S1a (Hitesh, 8 Nov) - "paid bookings" master switch. Soft launch is
// free-only: no money flows through AFA until an admin turns
// PlatformSettings.paidBookingsEnabled on. This file is the single guard
// every money path calls. It has no Prisma import so unit self-tests and
// client components can use it; the DB read lives in platform-settings.ts
// (getPaidBookingsEnabled / assertPaidBookingsEnabled).
//
// Free stays free: an amount of 0 (no order to create) is never blocked.

export const PAID_BOOKINGS_DISABLED = "PAID_BOOKINGS_DISABLED" as const

export const PAID_BOOKINGS_DISABLED_MESSAGE =
  "Paid bookings are not open yet. Only free events can be booked for now."

export const PAID_TICKETS_COMING_SOON_MESSAGE =
  "Paid tickets are coming soon — publish as a free event for now."

export type PaidBookingsFlag = { paidBookingsEnabled: boolean }

export function isPaidBookingsEnabled(settings: PaidBookingsFlag | null | undefined): boolean {
  return settings?.paidBookingsEnabled === true
}

/**
 * The gate itself. Returns null when the request may go ahead, or the
 * 403 body to send back when it must be refused. A non-positive or
 * non-number amount is treated as free (the caller's own validation
 * decides whether that amount is otherwise acceptable).
 */
export function paidBookingBlock(
  amountPaise: number,
  enabled: boolean
): { status: 403; body: { error: string; code: typeof PAID_BOOKINGS_DISABLED } } | null {
  if (enabled) return null
  if (!(typeof amountPaise === "number" && amountPaise > 0)) return null
  return {
    status: 403,
    body: { error: PAID_BOOKINGS_DISABLED_MESSAGE, code: PAID_BOOKINGS_DISABLED },
  }
}

/** Thrown by the choke point (createRazorpayOrder) when the switch is off. */
export class PaidBookingsDisabledError extends Error {
  readonly code = PAID_BOOKINGS_DISABLED
  constructor() {
    super(PAID_BOOKINGS_DISABLED_MESSAGE)
    this.name = "PaidBookingsDisabledError"
  }
}

/** Throws PaidBookingsDisabledError for a paid amount while the switch is off. */
export function assertPaidAllowed(amountPaise: number, enabled: boolean): void {
  if (paidBookingBlock(amountPaise, enabled)) throw new PaidBookingsDisabledError()
}

/**
 * S1a - does an event create/edit body ask for paid tickets? True when the
 * event is not marked free (isFree omitted counts as "not saying") and a
 * flat ticketPrice or any section tier price is above 0. Only values the
 * body actually sends are checked, so a publish-only PATCH is unaffected.
 */
export function requestsPaidTickets(body: {
  isFree?: unknown
  ticketPrice?: unknown
  ticketTiers?: unknown
}): boolean {
  if (body.isFree === true) return false
  const positive = (v: unknown) =>
    v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v)) && Number(v) > 0
  if (positive(body.ticketPrice)) return true
  if (Array.isArray(body.ticketTiers)) {
    return body.ticketTiers.some((t: unknown) =>
      positive(t && typeof t === "object" ? (t as { price?: unknown }).price : undefined)
    )
  }
  return false
}
