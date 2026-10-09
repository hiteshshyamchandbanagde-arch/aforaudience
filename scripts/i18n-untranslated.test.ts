// BUG-2610-029 - no English left in the other languages' dictionaries on
// the audience pages. Run with tsx (from the repo root):
//
//   npx tsx scripts/i18n-untranslated.test.ts
//
// Reported on the Hindi homepage: the main button, ctaFindTonightsShow,
// was "Find tonight's show" in 10 of the 11 non-English dictionaries.
// i18n-dictionaries.test.ts checks the key set and placeholders, so a
// value copied from en.ts and never translated passed it.
//
// This lists every value that is identical to en.ts in another locale.
// - On the audience pages (CHECKED_GROUPS: homepage, /events, /venues,
//   /artists, event detail, checkout, and the nav/location/shared strings
//   on all of them), any such value fails the test unless it is allowed
//   below.
// - GEN-2610-007: the role dashboards are translated too, one namespace
//   per area (DASHBOARD_GROUPS), checked the same way. Admin stays English
//   and has no namespace.
// - Everywhere else it is printed as a leftover, so the list stays visible
//   until those pages get their own pass. It does not fail.
import assert from 'node:assert/strict'
import en from '../src/lib/i18n/dictionaries/en'

let passed = 0
async function test(name: string, fn: () => void | Promise<void>) {
  await fn()
  passed++
  console.log(`ok - ${name}`)
}

const OTHER_LOCALES = ['hi', 'mr', 'te', 'ta', 'kn', 'ml', 'gu', 'bn', 'de', 'fr', 'es']

/** GEN-2610-007 - the role dashboards' namespaces (6a: shared chrome + Artist; 6b: Organiser; 6c adds Venue Owner). */
export const DASHBOARD_GROUPS = ['dashboardChrome', 'artistDashboard', 'eventTermsChecklist', 'organiserDashboard']

/** Dictionary groups rendered on the homepage, /events, /venues, /artists, event detail and checkout, plus the dashboards'. */
export const CHECKED_GROUPS = [
  'common', 'nav', 'roles', 'search', 'location', 'eventTypes', 'availability', 'bookingStatus',
  'homePage', 'eventsPage', 'venuesPage', 'venueDetailPage', 'artistsPage', 'eventDetailPage', 'checkoutPage',
  ...DASHBOARD_GROUPS,
]

/**
 * Values that are the same word in that language, so identical to English
 * on purpose. Each entry names its locales; a new identical value anywhere
 * else still fails.
 */
export const ALLOWED: Record<string, { locales: string[]; why: string }> = {
  'common.dialogOk': { locales: ['de', 'fr'], why: '"OK" is the word in German and French' },
  'nav.events': { locales: ['de'], why: 'German uses "Events"' },
  'nav.tabEvents': { locales: ['de'], why: 'German uses "Events"' },
  'nav.dashboard': { locales: ['de'], why: 'German uses "Dashboard"' },
  'nav.tabDashboard': { locales: ['de'], why: 'German uses "Dashboard"' },
  'nav.tabTickets': { locales: ['de'], why: 'German uses "Tickets"' },
  'nav.wallOfFame': { locales: ['de'], why: 'feature name, kept in German' },
  'nav.tabWallOfFame': { locales: ['de'], why: 'feature name abbreviation (WOF)' },
  'nav.messages': { locales: ['fr'], why: '"Messages" is the French word' },
  'roles.ADMIN': { locales: ['de', 'fr', 'es'], why: '"Admin" is the word in de/fr/es' },
  'eventTypes.OPEN_MIC': { locales: ['de'], why: 'German uses "Open Mic"' },
  'eventTypes.THEATER': { locales: ['de'], why: '"Theater" is the German word' },
  'eventsPage.toggleEvents': { locales: ['de'], why: 'German uses "Events"' },
  'venuesPage.resultsCountInCity': { locales: ['de'], why: '"in" is the German word' },
  'artistsPage.showsLabel': { locales: ['de'], why: 'German uses "Shows"' },
  'venueDetailPage.sectionColumnLabel': { locales: ['fr'], why: '"Section" is the French word' },
  'venueDetailPage.sectionsLabel': { locales: ['fr'], why: '"sections" is the French word' },
  'venueDetailPage.totalLabel': { locales: ['fr', 'es'], why: '"Total" is the French and Spanish word' },
  'eventDetailPage.totalLabel': { locales: ['fr', 'es'], why: '"Total" is the French and Spanish word' },
  'eventDetailPage.hypeLabel': { locales: ['de', 'fr', 'es'], why: '"Hype" is used as is in de/fr/es' },
  'eventDetailPage.no': { locales: ['es'], why: '"No" is the Spanish word' },
  'homePage.tonightRailLive': { locales: ['de'], why: 'German uses "LIVE"' },
  'homePage.nearYouTabEvents': { locales: ['de'], why: 'German uses "Events"' },
  'homePage.tickerSpokenWordKolkata': { locales: ['de'], why: 'genre name + city, kept in German' },
  'homePage.fourRoomsHouseStep3': { locales: ['de'], why: '"Ticket" is the German word' },
  'homePage.footerLivestreams': { locales: ['de', 'fr'], why: '"Livestreams" is used as is in de/fr' },
  'homePage.footerBlog': { locales: ['de', 'fr', 'es'], why: '"Blog" is the word in de/fr/es' },
  'artistDashboard.genres': { locales: ['de', 'fr'], why: '"Genres" is the German and French word' },
  'artistDashboard.tour': { locales: ['de'], why: '"Tour" is the German word' },
  'artistDashboard.linkOptional': { locales: ['de'], why: '"Link (optional)" is the German wording' },
  'artistDashboard.budgetLabel': { locales: ['de'], why: '"Budget" is the German word' },
  'artistDashboard.influences': { locales: ['fr'], why: '"Influences" is the French word' },
  'organiserDashboard.eventDetail.compBuyIn': { locales: OTHER_LOCALES, why: '"Buy-in" is the AFA slot-type name, kept in Latin script in every language' },
}

/** Proper nouns that read the same in every language. */
const PROPER_NOUNS = ['AforAudience', 'AFA']

/**
 * True when the value has nothing to translate: no letters once the
 * placeholders, proper nouns, ₹ amounts, e-mail addresses and short
 * all-capital codes are taken out ("—", " →", "", "{count}", "₹20").
 */
export function nothingToTranslate(value: string): boolean {
  let rest = value.replace(/\{\w+\}/g, '')
  rest = rest.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '')
  for (const noun of PROPER_NOUNS) rest = rest.split(noun).join('')
  rest = rest.replace(/₹\s?[\d,.]+/g, '')
  rest = rest.replace(/\b[A-Z0-9]{2,4}\b/g, '')
  return !/\p{L}/u.test(rest)
}

type Flat = Record<string, unknown>
function flatten(obj: Record<string, unknown>, prefix = '', out: Flat = {}): Flat {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object') flatten(v as Record<string, unknown>, `${prefix}${k}.`, out)
    else out[`${prefix}${k}`] = v
  }
  return out
}

export type Finding = { locale: string; key: string; value: string }

/** Values identical to English that need translating, split into the checked pages and the rest. */
export function untranslated(flatEn: Flat, dictionaries: Record<string, Flat>) {
  const checked: Finding[] = []
  const leftovers: Finding[] = []
  for (const [locale, dict] of Object.entries(dictionaries)) {
    for (const [key, enValue] of Object.entries(flatEn)) {
      if (typeof enValue !== 'string' || dict[key] !== enValue) continue
      if (nothingToTranslate(enValue)) continue
      if (ALLOWED[key]?.locales.includes(locale)) continue
      const finding = { locale, key, value: enValue }
      if (CHECKED_GROUPS.includes(key.split('.')[0])) checked.push(finding)
      else leftovers.push(finding)
    }
  }
  return { checked, leftovers }
}

async function main() {
  const flatEn = flatten(en)
  const dictionaries: Record<string, Flat> = {}
  for (const id of OTHER_LOCALES) {
    dictionaries[id] = flatten((await import(`../src/lib/i18n/dictionaries/${id}`)).default)
  }
  const { checked, leftovers } = untranslated(flatEn, dictionaries)

  await test('[BUG-2610-029] homePage.ctaFindTonightsShow is translated in all 11 other locales', () => {
    const english = OTHER_LOCALES.filter((id) => dictionaries[id]['homePage.ctaFindTonightsShow'] === flatEn['homePage.ctaFindTonightsShow'])
    assert.deepEqual(english, [])
  })

  await test('[BUG-2610-029] no English left on the homepage, /events, /venues, /artists, event detail or checkout', () => {
    assert.deepEqual(
      checked.map((f) => `${f.locale} ${f.key}: "${f.value}"`),
      [],
    )
  })

  await test('[GEN-2610-007] the dashboard namespaces exist in en.ts with the shared chrome, Artist and Organiser strings', () => {
    for (const group of DASHBOARD_GROUPS) {
      assert.ok(Object.keys(flatEn).some((k) => k.startsWith(`${group}.`)), `${group} is missing from en.ts`)
    }
    for (const key of [
      'dashboardChrome.myEvents', 'dashboardChrome.more', 'artistDashboard.applicationsTitle', 'artistDashboard.browseTitle',
      // 6b-1: Organiser Your Events, event detail, Create Event, Edit Event.
      'organiserDashboard.yourEvents.title', 'organiserDashboard.eventDetail.artistApplications',
    ]) {
      assert.equal(typeof flatEn[key], 'string', `${key} is missing from en.ts`)
    }
  })

  await test('[GEN-2610-007] no English left in the dashboard namespaces (shared chrome, Artist, Organiser) in any of the 11 other locales', () => {
    const dashboard = checked.filter((f) => DASHBOARD_GROUPS.includes(f.key.split('.')[0]))
    assert.deepEqual(
      dashboard.map((f) => `${f.locale} ${f.key}: "${f.value}"`),
      [],
    )
  })

  await test('every allow-list entry is still needed (no stale exemptions)', () => {
    const stale: string[] = []
    for (const [key, { locales }] of Object.entries(ALLOWED)) {
      assert.ok(key in flatEn, `${key} is not in en.ts`)
      for (const id of locales) if (dictionaries[id][key] !== flatEn[key]) stale.push(`${id} ${key}`)
    }
    assert.deepEqual(stale, [])
  })

  await test('the check catches a copied English value and lets through what has nothing to translate (negative control)', () => {
    const fakeEn = { homePage: { cta: "Find tonight's show", arrow: ' →', price: '₹20', mail: 'you@example.com', brand: 'AforAudience' }, profilePage: { title: 'Profile' } }
    const flat = flatten(fakeEn)
    const { checked: c, leftovers: l } = untranslated(flat, { hi: flat })
    assert.deepEqual(c.map((f) => f.key), ['homePage.cta'])
    assert.deepEqual(l.map((f) => f.key), ['profilePage.title'])
  })

  // Not a failure: the pages this ticket doesn't cover, listed so they stay visible.
  const byKey = new Map<string, string[]>()
  for (const f of leftovers) byKey.set(f.key, [...(byKey.get(f.key) ?? []), f.locale])
  console.log(`\nLeftovers outside the checked pages (${leftovers.length} values, ${byKey.size} keys):`)
  for (const [key, locales] of byKey) console.log(`  ${key} [${locales.join(',')}]: "${flatEn[key]}"`)

  console.log(`\n${passed} passed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
