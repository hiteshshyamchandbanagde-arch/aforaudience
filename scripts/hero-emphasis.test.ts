// BUG-2610-031 - the highlighted (gold italic) word in a hero heading.
// Run with tsx:
//
//   npx tsx scripts/hero-emphasis.test.ts
//
// The bug: /venues in hi, "जहाँ शो होता है" - the italic "शो" had no
// visible space after it and its slant ran into "होता". Two causes, both
// checked here for every locale:
//   1. the space must sit OUTSIDE the highlighted span: the text before
//      it ends with a space, the emphasis has none at either end, and the
//      text after starts with a space or punctuation;
//   2. the italic overhang needs room: every hero emphasis renders
//      through HeroEmphasis (src/components/HeroEmphasis.tsx), which pads
//      its trailing edge, never a hand-written <em>.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import bn from '../src/lib/i18n/dictionaries/bn'
import de from '../src/lib/i18n/dictionaries/de'
import en from '../src/lib/i18n/dictionaries/en'
import es from '../src/lib/i18n/dictionaries/es'
import fr from '../src/lib/i18n/dictionaries/fr'
import gu from '../src/lib/i18n/dictionaries/gu'
import hi from '../src/lib/i18n/dictionaries/hi'
import kn from '../src/lib/i18n/dictionaries/kn'
import ml from '../src/lib/i18n/dictionaries/ml'
import mr from '../src/lib/i18n/dictionaries/mr'
import ta from '../src/lib/i18n/dictionaries/ta'
import te from '../src/lib/i18n/dictionaries/te'
import { HERO_EMPHASIS_STYLE } from '../src/components/HeroEmphasis'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const LOCALES = { bn, de, en, es, fr, gu, hi, kn, ml, mr, ta, te } as const
type Dict = typeof en

/** Every hero heading with a highlighted word: [before, emphasis, after] (undefined = a line edge). */
const GROUPS: { name: string; parts: (d: Dict) => [string | undefined, string, string | undefined] }[] = [
  { name: 'venuesPage.heading', parts: (d) => [d.venuesPage.headingPrefix, d.venuesPage.headingEmphasis, d.venuesPage.headingSuffix] },
  { name: 'eventsPage.hero (events)', parts: (d) => [d.eventsPage.heroPrefixEvents, d.eventsPage.heroEmphasisEvents, d.eventsPage.heroSuffixEvents] },
  { name: 'eventsPage.hero (organisers)', parts: (d) => [d.eventsPage.heroPrefixOrganisers, d.eventsPage.heroEmphasisOrganisers, d.eventsPage.heroSuffixOrganisers] },
  { name: 'organisersPage.hero', parts: (d) => [d.organisersPage.heroPrefix, d.organisersPage.heroEmphasis, d.organisersPage.heroSuffix] },
  { name: 'venueOwnersPage.hero', parts: (d) => [d.venueOwnersPage.heroPrefix, d.venueOwnersPage.heroEmphasis, d.venueOwnersPage.heroSuffix] },
  { name: 'artistsPage.hero', parts: (d) => [d.artistsPage.heroPrefix, d.artistsPage.heroEmphasis, d.artistsPage.heroSuffix] },
  { name: 'wallOfFamePage.hero', parts: (d) => [d.wallOfFamePage.heroPrefix, d.wallOfFamePage.heroEmphasis, undefined] },
  // Line 1 ends in a <br />, so the emphasis starts its line.
  { name: 'homePage.fourRoomsHeading', parts: (d) => [undefined, d.homePage.fourRoomsHeadingEmphasis, d.homePage.fourRoomsHeadingSuffix] },
  // The home hero's last line: heroLine2 then the italic heroLine3.
  { name: 'homePage.heroLine2/3', parts: (d) => [d.homePage.heroLine2, d.homePage.heroLine3, undefined] },
]

// After the emphasis: a space, or punctuation that hugs the word.
const STARTS_OK = /^(\s|[.,!?;:।…)»"'’])/u

export function spacingProblems(before: string | undefined, emphasis: string, after: string | undefined): string[] {
  const problems: string[] = []
  if (emphasis !== emphasis.trim()) problems.push(`emphasis ${JSON.stringify(emphasis)} has a space inside the highlight`)
  if (!emphasis.trim()) problems.push('emphasis is empty')
  if (before && !/\s$/u.test(before)) problems.push(`${JSON.stringify(before)} needs a space before the highlight`)
  if (after && !STARTS_OK.test(after)) problems.push(`${JSON.stringify(after)} needs a space after the highlight`)
  return problems
}

test('spacingProblems catches the three ways a split goes wrong, and passes good ones', () => {
  assert.deepEqual(spacingProblems('जहाँ ', 'शो', ' होता है।'), [])
  assert.deepEqual(spacingProblems('Donde ocurre el ', 'espectáculo', '.'), [])
  assert.deepEqual(spacingProblems('', 'आयोजकों', ' से मिलें'), [])
  assert.equal(spacingProblems('जहाँ ', 'शो ', 'होता है।').length, 2, 'space inside the span, none after')
  assert.equal(spacingProblems('ihr', 'Publikum findet', undefined).length, 1, 'no space before')
  assert.equal(spacingProblems('Where the', 'show', 'happens.').length, 2)
})

for (const g of GROUPS) {
  test(`${g.name}: the space is outside the highlighted word in all ${Object.keys(LOCALES).length} locales`, () => {
    const found: string[] = []
    for (const [id, d] of Object.entries(LOCALES)) {
      const [before, emphasis, after] = g.parts(d as Dict)
      for (const p of spacingProblems(before, emphasis, after)) found.push(`${id}: ${p}`)
    }
    assert.deepEqual(found, [], found.join('\n'))
  })
}

test('HeroEmphasis leaves room for the italic overhang after the word', () => {
  assert.equal(HERO_EMPHASIS_STYLE.fontStyle, 'italic')
  const pad = String(HERO_EMPHASIS_STYLE.paddingInlineEnd ?? '')
  const em = Number(pad.replace(/em$/, ''))
  assert.ok(pad.endsWith('em') && em >= 0.1, `trailing padding scales with the heading (got ${pad})`)
})

// Static: no page hand-writes the gold italic <em> any more.
const SITES = [
  'src/app/venues/VenuesHero.tsx',
  'src/app/(public)/events/page.tsx',
  'src/app/(public)/organisers/page.tsx',
  'src/app/(public)/venue-owners/page.tsx',
  'src/app/(public)/wall-of-fame/page.tsx',
  'src/components/FourRooms.tsx',
  'src/components/Hero.tsx',
]

test('every hero emphasis renders through HeroEmphasis', () => {
  const root = path.join(__dirname, '..')
  const found: string[] = []
  for (const rel of SITES) {
    const src = readFileSync(path.join(root, rel), 'utf8')
    if (/<em\b[^>]*fontStyle:\s*["']italic/.test(src)) found.push(`${rel}: hand-written italic <em>`)
    if (!/<HeroEmphasis\b/.test(src)) found.push(`${rel}: no <HeroEmphasis>`)
  }
  assert.deepEqual(found, [], found.join('\n'))
})

console.log(`\n${passed} passed`)
