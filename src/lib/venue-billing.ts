// BUG-2609-083 - how long a venue is hired for, and how many hours that
// is billed as. One rule for the create and edit pages and for both
// server routes, so the price shown is the price that gets recorded.
//
// Before this, the two pages priced the exact fraction (14 h 58 m at
// ₹2500/hr showed "× 14.966666666666667 hr" = ₹37,417) while the server
// recorded Math.round(minutes / 60) hours.
//
// Rule (chat, delegated, 3 Oct): bill in half-hours, rounded up, and
// never less than the venue's minimum.

export interface VenueHireDuration {
  /** Actual length of the event, in minutes. */
  minutes: number
  /** True when the end time is on the next day (end <= start). */
  crossesMidnight: boolean
  /** Hours charged: half-hours, rounded up, at least the venue minimum. */
  billedHours: number
}

function toMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(time ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/**
 * startTime/endTime are 24-hour "HH:MM", as stored on Event. An end at or
 * before the start means the event runs into the next day, so equal
 * times are a full 24 hours (the same reading as formatEventTimeRange).
 * Returns null when either time is missing or malformed.
 */
export function billableHours(
  startTime: string,
  endTime: string,
  minDurationHours?: number | null,
): VenueHireDuration | null {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  if (start === null || end === null) return null
  const crossesMidnight = end <= start
  const minutes = crossesMidnight ? end - start + 24 * 60 : end - start
  const billedHours = Math.max(Math.ceil(minutes / 30) / 2, minDurationHours || 0)
  return { minutes, crossesMidnight, billedHours }
}

/**
 * The duration columns (VenueBooking.durationHours,
 * VenueBookingRequest.durationHours) are whole numbers, so a half-hour
 * is recorded rounded up. The amount is what carries the exact price.
 */
export function wholeBilledHours(billedHours: number): number {
  return Math.ceil(billedHours)
}

/** 898 -> "14 h 58 m", 120 -> "2 h", 45 -> "45 m" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} m`
  return m === 0 ? `${h} h` : `${h} h ${m} m`
}

/** 15 -> "15", 2.5 -> "2.5" */
export function formatBilledHours(billedHours: number): string {
  return String(billedHours)
}

/** An event this long, or one that ends the next day, is often an AM/PM slip. */
export const LONG_EVENT_MINUTES = 8 * 60

export function isUnusuallyLong(d: VenueHireDuration): boolean {
  return d.crossesMidnight || d.minutes > LONG_EVENT_MINUTES
}

/** Rupee total for an hourly venue. */
export function hourlyTotal(ratePerHour: number, billedHours: number): number {
  return Math.round(ratePerHour * billedHours)
}

/**
 * The text after the amount on the Book a Venue card, e.g.
 *   "₹2500/hr × 15 hr (14 h 58 m, billed as 15 hr)"
 *   "₹2500/hr × 3 hr (min 3 hr)"
 *   "₹2500/hr × 2 hr"
 */
export function hourlyNote(ratePerHour: number, d: VenueHireDuration, minDurationHours?: number | null): string {
  const base = `₹${ratePerHour}/hr × ${formatBilledHours(d.billedHours)} hr`
  const roundedUp = Math.ceil(d.minutes / 30) / 2
  if (minDurationHours && d.billedHours > roundedUp) return `${base} (min ${minDurationHours} hr)`
  if (d.minutes !== d.billedHours * 60) {
    return `${base} (${formatDuration(d.minutes)}, billed as ${formatBilledHours(d.billedHours)} hr)`
  }
  return base
}

/** The non-blocking note under the time fields, or null when the length looks ordinary. */
export function longEventWarning(d: VenueHireDuration): string | null {
  if (!isUnusuallyLong(d)) return null
  const length = formatDuration(d.minutes)
  return d.crossesMidnight
    ? `This event runs ${length} and ends the next day. Check AM/PM.`
    : `This event runs ${length}. Check AM/PM.`
}
