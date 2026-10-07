// GEN-2610-005 - city centres for "Use my location". The nearest-city
// check (src/lib/nearest-city.ts) needs a point for every city that has
// an approved venue, and most venues have no lat/lng (Pune's demo venues,
// the load-test venues, anything added before Places geocoding). There is
// no geocoding API to fill the gap (the Google keys are dead), so the
// centres live here, committed and reviewable.
//
// Chosen over backfilling venue lat/lng in scripts/qa-seed.ts because a
// seed backfill fixes only the QA rows the seed writes: venues an owner
// adds through the app, and the load-test venues (faker cities), would
// still have no point and silently drop out of "nearest". A city listed
// here works on every environment whatever its venues hold. A city not
// listed falls back to the average of its venues' own lat/lng, and is
// left out only when it has neither.
//
// Keys are the city name exactly as Venue.city stores it. Approximate
// town centres, 4 decimals (about 10 m) - far finer than the 50 km
// "near" radius needs. Add a row when a city with venues shows up here
// missing (the self-test lists QA's current cities).
export const CITY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  // QA cities with approved venues on 7 Oct 2026
  Ballari: { lat: 15.1394, lng: 76.9214 },
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Byasanagar: { lat: 20.9306, lng: 86.1207 },
  Faridkot: { lat: 30.6769, lng: 74.7583 },
  Jaipur: { lat: 26.9124, lng: 75.7873 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Narayanpet: { lat: 16.7445, lng: 77.496 },
  Nelamangala: { lat: 13.0977, lng: 77.3936 },
  Panniyannur: { lat: 11.7552, lng: 75.5568 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  Puttur: { lat: 12.7594, lng: 75.2017 },
  Samalkha: { lat: 29.235, lng: 77.0123 },
  Thammampatti: { lat: 11.44, lng: 78.48 },
  Thiruthuraipoondi: { lat: 10.53, lng: 79.64 },
  // Other metros scripts/qa-seed-venues.ts can write
  Delhi: { lat: 28.7041, lng: 77.1025 },
  'New Delhi': { lat: 28.6139, lng: 77.209 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
}
