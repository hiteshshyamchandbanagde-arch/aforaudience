import { istDayKey } from './format-date'

// BUG-2610-022 - an artist's application for an event that has already
// happened can no longer be decided. Its stored status stays as it is (no
// data migration); every screen derives "Closed" from the event's date
// instead, and the organiser's pending counts (the nav badge from
// /api/notifications/pending-count and the per-event "N pending
// applications") leave it out.

export interface ApplicationEventLike {
  date: string | Date
  startTime?: string | null
}

/**
 * When the event starts, read in India time: Event.date's India-time day
 * plus startTime ("19:00"). The same instant on the server (UTC) and in
 * the browser, whatever their time zones. No startTime: the end of that day.
 */
export function eventStartsAt(event: ApplicationEventLike): Date {
  const day = istDayKey(event.date)
  const time = event.startTime && /^\d{1,2}:\d{2}$/.test(event.startTime) ? event.startTime.padStart(5, '0') : '23:59'
  return new Date(`${day}T${time}:00+05:30`)
}

export function isPastEvent(event: ApplicationEventLike, now: Date = new Date()): boolean {
  return eventStartsAt(event).getTime() <= now.getTime()
}

/** Still waiting on the organiser: PENDING, or WAITLISTED (also decided by hand). */
export function isUndecided(status: string): boolean {
  return status === 'PENDING' || status === 'WAITLISTED'
}

/** The status to show: an undecided application for a past event is CLOSED. */
export function displayApplicationStatus(status: string, event: ApplicationEventLike, now: Date = new Date()): string {
  return isUndecided(status) && isPastEvent(event, now) ? 'CLOSED' : status
}

/** PENDING applications whose event is still ahead: the ones an organiser can act on. */
export function countOpenPendingApplications(apps: { status: string; event: ApplicationEventLike }[], now: Date = new Date()): number {
  return apps.filter((a) => a.status === 'PENDING' && !isPastEvent(a.event, now)).length
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Upcoming first (soonest first), then past (most recent first). Two
 * events that start at the same time keep one fixed order, by event title
 * then application id, so the list never depends on the order the API
 * returned them in.
 */
export function splitApplicationsByEventDate<T extends { id: string; event: ApplicationEventLike & { title: string } }>(apps: T[], now: Date = new Date()): { upcoming: T[]; past: T[] } {
  const at = (a: T) => eventStartsAt(a.event).getTime()
  const tie = (a: T, b: T) => byText(a.event.title, b.event.title) || byText(a.id, b.id)
  const upcoming = apps.filter((a) => !isPastEvent(a.event, now)).sort((a, b) => at(a) - at(b) || tie(a, b))
  const past = apps.filter((a) => isPastEvent(a.event, now)).sort((a, b) => at(b) - at(a) || tie(a, b))
  return { upcoming, past }
}
