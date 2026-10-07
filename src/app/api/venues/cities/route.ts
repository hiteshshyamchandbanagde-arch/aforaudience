import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cityLabel } from '@/lib/country-codes'
import { cityPoint } from '@/lib/nearest-city'

// FEAT-2608-036. Deliberately NOT using CityAutocomplete/Places API here -
// that endpoint is auth-gated specifically to stop anonymous traffic from
// hammering the billed Google quota (see comment in
// api/places/autocomplete/route.ts), and this location picker has to work
// for signed-out visitors too. Distinct city list off our own Venue table
// is free, public, and only ever offers cities we actually have venues
// in - which is the right scope for "near you", not the whole world.
//
// distinct on [city, country] (not just city) - if two different
// countries ever do share a city name, this surfaces both as separate
// entries instead of silently picking one country to mislabel the other
// with. The underlying filter value stays the bare city string though
// (see cityLabel usage on the client) - a genuine collision would still
// filter identically for either entry until the filter itself is made
// city+country aware, which is a bigger follow-up, not bundled in here.
//
// GEN-2610-005 - each city also carries a point (lat/lng) for "Use my
// location": its committed centre (src/lib/city-centroids.ts) or the
// average of its venues' own coordinates, null when neither exists.
// (The chip renders its own label with chipCityLabel; `label` here stays
// "Pune (IN)" for the /events and artist-events city dropdowns.)
export async function GET() {
  const rows = await prisma.venue.findMany({
    where: { isApproved: true },
    select: { city: true, country: true, lat: true, lng: true },
    orderBy: [{ city: 'asc' }, { country: 'asc' }],
  })
  const byCity = new Map<string, { city: string; country: string | null; coords: { lat: number | null; lng: number | null }[] }>()
  for (const r of rows as { city: string; country: string | null; lat: number | null; lng: number | null }[]) {
    if (!r.city) continue
    const key = `${r.city}\u0000${r.country ?? ''}`
    const entry = byCity.get(key) ?? { city: r.city, country: r.country, coords: [] }
    entry.coords.push({ lat: r.lat, lng: r.lng })
    byCity.set(key, entry)
  }
  const cities = [...byCity.values()].map((c) => {
    const point = cityPoint(c.city, c.coords)
    return {
      city: c.city,
      country: c.country,
      label: cityLabel(c.city, c.country),
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
    }
  })
  return NextResponse.json({ cities })
}
