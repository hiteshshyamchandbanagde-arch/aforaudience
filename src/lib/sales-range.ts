// Shared range filtering for the sales/revenue dashboards (Organiser
// ticket sales, Venue Owner revenue). One place for "what does 'this
// month' mean" so the per-event/per-venue drill-down pages and the
// overview pages can't drift out of sync on the definition.

export type SalesRange = 'week' | 'month' | 'quarter' | 'year' | 'all'

export const RANGE_LABELS: Record<SalesRange, string> = {
  week: 'This Week',
  month: 'This Month',
  quarter: 'This Quarter',
  year: 'This Year',
  all: 'All Time',
}

export function parseRange(value: string | null): SalesRange {
  if (value === 'week' || value === 'month' || value === 'quarter' || value === 'year' || value === 'all') {
    return value
  }
  return 'all'
}

// Returns the inclusive start of the range, or null for 'all' (no lower
// bound). All calculations are in server-local time — acceptable for a
// single-timezone (India) product; revisit if that ever changes.
export function getRangeStart(range: SalesRange, now: Date = new Date()): Date | null {
  const d = new Date(now)
  switch (range) {
    case 'week': {
      // Monday-start week.
      const day = d.getDay() // 0 = Sunday
      const diff = (day === 0 ? 6 : day - 1)
      d.setDate(d.getDate() - diff)
      d.setHours(0, 0, 0, 0)
      return d
    }
    case 'month': {
      d.setDate(1)
      d.setHours(0, 0, 0, 0)
      return d
    }
    case 'quarter': {
      const qStartMonth = Math.floor(d.getMonth() / 3) * 3
      d.setMonth(qStartMonth, 1)
      d.setHours(0, 0, 0, 0)
      return d
    }
    case 'year': {
      d.setMonth(0, 1)
      d.setHours(0, 0, 0, 0)
      return d
    }
    case 'all':
    default:
      return null
  }
}

// For delta indicators ("▲ 12% vs last period"): the equivalent prior
// period, same length, immediately preceding rangeStart. Deliberately NOT
// "the whole previous calendar month/quarter/etc." - if `now` is partway
// through the current period, comparing against a full prior period would
// be apples-to-oranges (e.g. 12 days into this month vs. all 31 days of
// last month always reads as a decline). 'all' has no bounded start, so
// there's no meaningful "previous" period - returns null.
export function getPreviousRangeBounds(range: SalesRange, now: Date = new Date()): { start: Date; end: Date } | null {
  const rangeStart = getRangeStart(range, now)
  if (!rangeStart) return null
  const durationMs = now.getTime() - rangeStart.getTime()
  return { start: new Date(rangeStart.getTime() - durationMs), end: rangeStart }
}

// BUG-2609-087 - venue revenue is counted by EVENT date (the booking's
// fromDate), not by when the booking was made, so a range there is the
// whole calendar period in India time: "month" is 1st to last, and it
// includes confirmed events later this month. (Ticket sales above stay
// "made in this window so far", by createdAt.)
const IST_OFFSET_MS = 330 * 60_000

// [start, end) of the calendar week (Monday start), month, quarter or
// year that `now` falls in, in India time. null for 'all'.
export function getCalendarRangeBounds(range: SalesRange, now: Date = new Date()): { start: Date; end: Date } | null {
  if (range === 'all') return null
  // India wall-clock time, read through the UTC getters.
  const wall = new Date(now.getTime() + IST_OFFSET_MS)
  const y = wall.getUTCFullYear()
  const m = wall.getUTCMonth()
  const d = wall.getUTCDate()
  let start: number
  let end: number
  if (range === 'week') {
    const day = wall.getUTCDay() // 0 = Sunday
    const monday = d - (day === 0 ? 6 : day - 1)
    start = Date.UTC(y, m, monday)
    end = Date.UTC(y, m, monday + 7)
  } else if (range === 'month') {
    start = Date.UTC(y, m, 1)
    end = Date.UTC(y, m + 1, 1)
  } else if (range === 'quarter') {
    const q = Math.floor(m / 3) * 3
    start = Date.UTC(y, q, 1)
    end = Date.UTC(y, q + 3, 1)
  } else {
    start = Date.UTC(y, 0, 1)
    end = Date.UTC(y + 1, 0, 1)
  }
  return { start: new Date(start - IST_OFFSET_MS), end: new Date(end - IST_OFFSET_MS) }
}

// The whole calendar period before the current one (last week, last
// month...), for the delta on a by-event-date figure. null for 'all'.
export function getPreviousCalendarRangeBounds(range: SalesRange, now: Date = new Date()): { start: Date; end: Date } | null {
  const current = getCalendarRangeBounds(range, now)
  if (!current) return null
  return getCalendarRangeBounds(range, new Date(current.start.getTime() - 1))
}

// bucketKeyFor's India-time twin, for an event date: "YYYY-MM" (year /
// all), a Monday-anchored "YYYY-MM-DD" (quarter), or a daily
// "YYYY-MM-DD" (week / month).
export function eventDateBucketKey(range: SalesRange, date: Date): string {
  const wall = new Date(date.getTime() + IST_OFFSET_MS)
  if (range === 'year' || range === 'all') return wall.toISOString().slice(0, 7)
  if (range === 'quarter') {
    const day = wall.getUTCDay()
    wall.setUTCDate(wall.getUTCDate() - (day === 0 ? 6 : day - 1))
  }
  return wall.toISOString().slice(0, 10)
}

// Bucket granularity for timeline charts scales with range so a Year
// view isn't 365 one-pixel bars.
export function bucketKeyFor(range: SalesRange, date: Date): string {
  if (range === 'year' || range === 'all') {
    // Monthly buckets: YYYY-MM
    return date.toISOString().slice(0, 7)
  }
  if (range === 'quarter') {
    // Weekly buckets: ISO year + week number, approximated with a
    // Monday-anchored date key (good enough for a chart, not a payroll
    // system).
    const d = new Date(date)
    const day = d.getDay()
    const diff = day === 0 ? 6 : day - 1
    d.setDate(d.getDate() - diff)
    return d.toISOString().slice(0, 10)
  }
  // week / month: daily buckets
  return date.toISOString().slice(0, 10)
}
