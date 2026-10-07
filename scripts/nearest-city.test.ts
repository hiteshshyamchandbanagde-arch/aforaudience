// GEN-2610-005 - self-tests for src/lib/nearest-city.ts ("Use my
// location") and the chip's city label. Same plain Node + assert
// convention as format-date.test.ts. Run with tsx:
//
//   npx tsx scripts/nearest-city.test.ts
import assert from 'node:assert/strict'
import { CITY_CENTROIDS } from '../src/lib/city-centroids'
import { cityPoint, haversineKm, locateOutcome, nearestCity, NEAR_CITY_KM, roundKm, type CityPoint } from '../src/lib/nearest-city'
import { chipCityLabel } from '../src/lib/country-codes'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

// The places the e2e spec (e2e/use-my-location.spec.ts) stubs.
const PUNE_CENTRE = { lat: 18.5204, lng: 73.8567 }
const BANDRA = { lat: 19.0596, lng: 72.8295 }
const LONAVALA = { lat: 18.7546, lng: 73.4062 }

// QA's cities with an approved venue on 7 Oct 2026 (Mumbai = Bandra
// Basement Stage, the venue chip inserted that day).
const QA_CITIES = [
  'Ballari', 'Bengaluru', 'Byasanagar', 'Faridkot', 'Jaipur', 'Mumbai', 'Narayanpet',
  'Nelamangala', 'Panniyannur', 'Pune', 'Puttur', 'Samalkha', 'Thammampatti', 'Thiruthuraipoondi',
]

const points: CityPoint[] = QA_CITIES.map((city) => ({ city, country: 'India', ...CITY_CENTROIDS[city] }))

test('every QA city with an approved venue has a committed centre', () => {
  const missing = QA_CITIES.filter((c) => !CITY_CENTROIDS[c])
  assert.deepEqual(missing, [])
})

test('haversine: zero for the same point, symmetric, Mumbai-Pune about 120 km', () => {
  assert.equal(haversineKm(18.5, 73.8, 18.5, 73.8), 0)
  const mp = haversineKm(CITY_CENTROIDS.Mumbai.lat, CITY_CENTROIDS.Mumbai.lng, CITY_CENTROIDS.Pune.lat, CITY_CENTROIDS.Pune.lng)
  const pm = haversineKm(CITY_CENTROIDS.Pune.lat, CITY_CENTROIDS.Pune.lng, CITY_CENTROIDS.Mumbai.lat, CITY_CENTROIDS.Mumbai.lng)
  assert.equal(mp, pm)
  assert.ok(mp > 115 && mp < 125, `Mumbai-Pune ${mp} km`)
})

test('haversine: antipodes are half the earth round, no NaN', () => {
  const km = haversineKm(0, 0, 0, 180)
  assert.ok(Math.abs(km - Math.PI * 6371) < 0.001, `${km}`)
})

test('in Pune: nearest is Pune, well within the radius', () => {
  const n = nearestCity(PUNE_CENTRE.lat, PUNE_CENTRE.lng, points)
  assert.equal(n?.city, 'Pune')
  assert.ok(n!.km < 1)
})

test('in Bandra: nearest is Mumbai, not Pune', () => {
  const n = nearestCity(BANDRA.lat, BANDRA.lng, points)
  assert.equal(n?.city, 'Mumbai')
  assert.ok(n!.km < NEAR_CITY_KM)
})

test('in Lonavala: nearest is Pune, but past the radius (about 54 km)', () => {
  const n = nearestCity(LONAVALA.lat, LONAVALA.lng, points)
  assert.equal(n?.city, 'Pune')
  assert.ok(n!.km > NEAR_CITY_KM, `${n!.km} km`)
  assert.equal(roundKm(n!.km), 54)
})

test('no cities: null', () => {
  assert.equal(nearestCity(18.5, 73.8, []), null)
})

test('cityPoint: committed centre wins over venue coordinates', () => {
  assert.deepEqual(cityPoint('Pune', [{ lat: 1, lng: 1 }]), CITY_CENTROIDS.Pune)
})

test('cityPoint: unlisted city uses the average of its geocoded venues, ignoring null ones', () => {
  assert.deepEqual(cityPoint('Nowhere', [{ lat: 10, lng: 20 }, { lat: null, lng: null }, { lat: 12, lng: 22 }]), { lat: 11, lng: 21 })
})

test('cityPoint: unlisted city with no geocoded venue is left out', () => {
  assert.equal(cityPoint('Nowhere', [{ lat: null, lng: null }]), null)
  assert.equal(cityPoint('Nowhere', []), null)
})

const near = (city: string, km = 3) => ({ city, country: 'India', lat: 0, lng: 0, km })

test('outcome: nothing saved (guest on an IP guess) selects the near city', () => {
  assert.equal(locateOutcome({ nearest: near('Mumbai'), currentCity: 'Pune', saved: false, dismissedCities: [] }), 'select')
  assert.equal(locateOutcome({ nearest: near('Mumbai'), currentCity: null, saved: false, dismissedCities: [] }), 'select')
})

test('outcome: saved city differs -> prompt, never select', () => {
  assert.equal(locateOutcome({ nearest: near('Mumbai'), currentCity: 'Jaipur', saved: true, dismissedCities: [] }), 'prompt')
})

test('outcome: "Not now" said to this city -> dismissed; another city still prompts', () => {
  assert.equal(locateOutcome({ nearest: near('Mumbai'), currentCity: 'Jaipur', saved: true, dismissedCities: ['Mumbai'] }), 'dismissed')
  assert.equal(locateOutcome({ nearest: near('Pune'), currentCity: 'Jaipur', saved: true, dismissedCities: ['Mumbai'] }), 'prompt')
})

test('outcome: already in that city -> same (case-insensitive)', () => {
  assert.equal(locateOutcome({ nearest: near('Pune'), currentCity: 'pune', saved: true, dismissedCities: [] }), 'same')
  assert.equal(locateOutcome({ nearest: near('Pune'), currentCity: 'Pune', saved: false, dismissedCities: [] }), 'same')
})

test('outcome: past the radius -> far, saved or not, even if it is the current city', () => {
  assert.equal(locateOutcome({ nearest: near('Pune', NEAR_CITY_KM + 0.1), currentCity: 'Jaipur', saved: true, dismissedCities: [] }), 'far')
  assert.equal(locateOutcome({ nearest: near('Pune', NEAR_CITY_KM + 0.1), currentCity: null, saved: false, dismissedCities: [] }), 'far')
})

test('outcome: exactly on the radius still counts as near', () => {
  assert.equal(locateOutcome({ nearest: near('Pune', NEAR_CITY_KM), currentCity: null, saved: false, dismissedCities: [] }), 'select')
})

test('outcome: no cities -> none', () => {
  assert.equal(locateOutcome({ nearest: null, currentCity: 'Pune', saved: true, dismissedCities: [] }), 'none')
})

test('roundKm: whole km, never 0', () => {
  assert.equal(roundKm(53.6), 54)
  assert.equal(roundKm(0.2), 1)
})

test('chip label: one format whether the country came as a name, a code or not at all', () => {
  assert.equal(chipCityLabel('Pune', 'IN'), 'Pune')
  assert.equal(chipCityLabel('Jaipur', 'India'), 'Jaipur')
  assert.equal(chipCityLabel('Pune', null), 'Pune')
  assert.equal(chipCityLabel('Sydney', 'Australia'), 'Sydney (AU)')
  assert.equal(chipCityLabel('Sydney', 'AU'), 'Sydney (AU)')
  assert.equal(chipCityLabel('Atlantis', 'Nowhere'), 'Atlantis')
})

console.log(`\n${passed} passed`)
