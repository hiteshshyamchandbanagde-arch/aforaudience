// BUG-2609-082 - counts read "Showing 1 events", "1 bookings". Two small
// helpers, both on Intl.PluralRules so "one" means whatever the locale
// says it means (1 in English; 0 and 1 in French and Hindi).

const rules = new Map<string, Intl.PluralRules>()

function isOne(locale: string | null | undefined, n: number): boolean {
  const key = locale || 'en'
  let r = rules.get(key)
  if (!r) {
    try {
      r = new Intl.PluralRules(key)
    } catch {
      r = new Intl.PluralRules('en')
    }
    rules.set(key, r)
  }
  return r.select(n) === 'one'
}

/**
 * For dictionary strings: picks the singular or plural template for the
 * UI locale and fills in {n}.
 *   countText(locale, 1, t.eventsPage.showingCountOne, t.eventsPage.showingCount)
 */
export function countText(locale: string | null | undefined, n: number, one: string, other: string): string {
  return (isOne(locale, n) ? one : other).replace('{n}', String(n))
}

/**
 * For the English-only dashboard pages: "1 booking", "2 bookings",
 * "0 seats". Pass the plural when it isn't singular + "s".
 */
export function countNoun(n: number, singular: string, plural: string = `${singular}s`): string {
  return `${n} ${isOne('en', n) ? singular : plural}`
}
