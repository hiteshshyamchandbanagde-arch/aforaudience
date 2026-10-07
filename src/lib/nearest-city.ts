import { CITY_CENTROIDS } from './city-centroids'

// GEN-2610-005 - "Use my location": map a GPS fix to the nearest city
// that has approved venues. Pure functions, no I/O, shared by the
// LocationChip (client) and scripts/nearest-city.test.ts. No external
// geocoding: the cities come from /api/venues/cities and their points
// from city-centroids.ts or the venues' own lat/lng.

// "Near" = within this many km of a city's centre. Past it the chip says
// "No shows near you yet" and names the nearest city instead of picking it.
export const NEAR_CITY_KM = 50

export interface CityPoint {
  city: string
  country: string | null
  lat: number
  lng: number
}

export interface NearestCity extends CityPoint {
  km: number
}

const EARTH_RADIUS_KM = 6371

/** Great-circle distance in km between two lat/lng points. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * The point to measure a city from: its committed centre if listed, else
 * the average of the venue coordinates given, else null (left out).
 */
export function cityPoint(city: string, venueCoords: { lat: number | null; lng: number | null }[]): { lat: number; lng: number } | null {
  const centre = CITY_CENTROIDS[city]
  if (centre) return centre
  const known = venueCoords.filter((v): v is { lat: number; lng: number } => typeof v.lat === 'number' && typeof v.lng === 'number')
  if (known.length === 0) return null
  return {
    lat: known.reduce((s, v) => s + v.lat, 0) / known.length,
    lng: known.reduce((s, v) => s + v.lng, 0) / known.length,
  }
}

/** The closest city to (lat, lng), with its distance in km; null when there are no cities. */
export function nearestCity(lat: number, lng: number, cities: CityPoint[]): NearestCity | null {
  let best: NearestCity | null = null
  for (const c of cities) {
    const km = haversineKm(lat, lng, c.lat, c.lng)
    if (!best || km < best.km) best = { ...c, km }
  }
  return best
}

// What the chip does with a fix:
//   'select'    - near a city, nothing saved to protect: pick it (POST, manual cookie)
//   'same'      - near the city already showing: nothing to do
//   'prompt'    - near a different city than the saved one: ask "You seem to be in {city}. Switch?"
//   'dismissed' - as 'prompt', but "Not now" was already said to this city: stay quiet
//   'far'       - no city within NEAR_CITY_KM: "No shows near you yet. Nearest: {city}, {n} km"
//   'none'      - no cities with a known point at all
export type LocateOutcome = 'select' | 'same' | 'prompt' | 'dismissed' | 'far' | 'none'

export function locateOutcome(opts: {
  nearest: NearestCity | null
  currentCity: string | null
  // true when the current city is a deliberate choice (account city, or a
  // picked city in the cookie). A saved city is never overwritten without
  // the person saying Switch.
  saved: boolean
  dismissedCities: string[]
}): LocateOutcome {
  const { nearest, currentCity, saved, dismissedCities } = opts
  if (!nearest) return 'none'
  if (nearest.km > NEAR_CITY_KM) return 'far'
  if (currentCity && sameCity(nearest.city, currentCity)) return 'same'
  if (!saved || !currentCity) return 'select'
  return dismissedCities.some((c) => sameCity(c, nearest.city)) ? 'dismissed' : 'prompt'
}

/** Whole km for display; never "0 km". */
export function roundKm(km: number): number {
  return Math.max(1, Math.round(km))
}

function sameCity(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}
