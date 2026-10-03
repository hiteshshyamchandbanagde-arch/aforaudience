// BUG-2609-071 - the one place a date or time is turned into text.
//
// Before this, 18 sites called toLocaleDateString()/toLocaleString()
// with no locale, so the same event read "10/4/2026" in an en-US browser
// and "4/10/2026" in an en-IN one, and nothing in src pinned a time
// zone, so server-rendered dates (posters, email, PDF) used Vercel's UTC
// while client ones used the device zone.
//
// Every style below is unambiguous (the month is always a word) and is
// always rendered in India time. The locale is the app's UI locale
// (useLocale().locale) mapped to its Indian variant; server callers
// leave it out and get en-IN. Digits stay Latin in every locale, to
// match the rupee amounts next to them.
//
// scripts/check-design-tokens.js bans toLocaleDateString(),
// toLocaleTimeString() and a bare toLocaleString() everywhere else.

export const APP_TIME_ZONE = 'Asia/Kolkata'

const STYLES = {
  /** 4 Oct */
  short: { day: 'numeric', month: 'short' },
  /** 4 Oct 2026 */
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  /** Sun, 4 Oct */
  withWeekday: { weekday: 'short', day: 'numeric', month: 'short' },
  /** Sunday, 4 October */
  long: { weekday: 'long', day: 'numeric', month: 'long' },
  /** Sunday, 4 October 2026 */
  longWithYear: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  /** 4 Oct 2026, 7:15 pm */
  dateTime: { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true },
  /** 7:15 pm */
  time: { hour: 'numeric', minute: '2-digit', hour12: true },
  /** Oct */
  month: { month: 'short' },
  /** Oct 2026 */
  monthYearShort: { month: 'short', year: 'numeric' },
  /** October 2026 */
  monthYear: { month: 'long', year: 'numeric' },
} satisfies Record<string, Intl.DateTimeFormatOptions>

export type DateStyle = keyof typeof STYLES

const INDIAN_LOCALES = new Set(['en', 'hi', 'te', 'ta', 'kn', 'ml', 'gu', 'bn'])

/** UI locale id ("en", "hi", "de", a full tag, or nothing) -> the tag dates are formatted with. */
export function dateLocale(uiLocale?: string | null): string {
  const base = (uiLocale || 'en').split('-')[0].toLowerCase()
  return `${INDIAN_LOCALES.has(base) ? `${base}-IN` : base}-u-nu-latn`
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(style: DateStyle, uiLocale?: string | null): Intl.DateTimeFormat {
  const key = `${uiLocale || ''}|${style}`
  let f = formatters.get(key)
  if (!f) {
    const options = { ...STYLES[style], timeZone: APP_TIME_ZONE }
    try {
      f = new Intl.DateTimeFormat(dateLocale(uiLocale), options)
    } catch {
      f = new Intl.DateTimeFormat(dateLocale(null), options)
    }
    formatters.set(key, f)
  }
  return f
}

/** Formats an instant in India time. Returns '' for a missing or invalid date. */
export function formatDate(
  value: Date | string | number | null | undefined,
  style: DateStyle = 'medium',
  uiLocale?: string | null,
): string {
  if (value === null || value === undefined || value === '') return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return formatterFor(style, uiLocale).format(d)
}

/**
 * A Date for a calendar day (month is 0-based, like `new Date(y, m, d)`),
 * placed at noon India time so formatDate() shows that same day whatever
 * zone the device is in. For dates built from parts (a calendar grid, a
 * "2026-10" bucket key), not for stored instants.
 */
export function calendarDate(year: number, monthIndex: number, day = 1): Date {
  return new Date(Date.UTC(year, monthIndex, day, 6, 30))
}

function istParts(value: Date | string | number): { year: number; month: number; day: number } {
  const d = value instanceof Date ? value : new Date(value)
  const shifted = new Date(d.getTime() + 330 * 60_000)
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** "2026-10" - the India-time month an instant falls in. */
export function istMonthKey(value: Date | string | number): string {
  const { year, month } = istParts(value)
  return `${year}-${pad2(month)}`
}

/** "2026-10-04" - the India-time day an instant falls in. */
export function istDayKey(value: Date | string | number): string {
  const { year, month, day } = istParts(value)
  return `${year}-${pad2(month)}-${pad2(day)}`
}
