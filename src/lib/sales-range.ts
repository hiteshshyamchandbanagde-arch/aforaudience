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
