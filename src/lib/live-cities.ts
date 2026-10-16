// Events copy A (Hitesh decision, 14 Oct) - the home hero's tag counts the
// cities that have at least one upcoming APPROVED show, instead of the old
// hard-coded "six cities and counting". Pure half only (safe for Client
// Components and tsx self-tests); the cached DB read is
// live-cities.server.ts.

export type LiveCityEvent = {
  date: Date
  startTime: string
  venue: { city: string | null } | null
}

// Same date+startTime instant as the /events page's isPastEvent and the
// booking guard, so "upcoming" means the same thing here.
function startsAfter(e: LiveCityEvent, now: Date): boolean {
  const [h, m] = e.startTime.split(":").map(Number)
  const start = new Date(e.date)
  start.setHours(h || 0, m || 0, 0, 0)
  return start.getTime() > now.getTime()
}

/**
 * The distinct cities with an upcoming show, busiest first (then A-Z).
 * A missing or blank city never counts.
 */
export function liveCityNames(events: LiveCityEvent[], now: Date): string[] {
  const counts = new Map<string, number>()
  for (const e of events) {
    const city = e.venue?.city?.trim()
    if (!city || !startsAfter(e, now)) continue
    counts.set(city, (counts.get(city) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([city]) => city)
}

/**
 * The hero tag for those cities: 0 -> null (tag hidden), 1 -> "Live, right
 * now in {city}", 2+ -> "Live, right now — {n} cities and counting". {n}
 * is always plain digits, in every locale.
 */
export function heroLiveTag(cities: string[], forms: { many: string; one: string }): string | null {
  if (cities.length === 0) return null
  if (cities.length === 1) return forms.one.replace("{city}", cities[0])
  return forms.many.replace("{n}", String(cities.length))
}
