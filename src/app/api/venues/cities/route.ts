import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cityLabel } from '@/lib/country-codes'

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
export async function GET() {
  const rows = await prisma.venue.findMany({
    where: { isApproved: true },
    select: { city: true, country: true },
    distinct: ['city', 'country'],
    orderBy: [{ city: 'asc' }, { country: 'asc' }],
  })
  const cities = rows
    .filter((r: { city: string; country: string | null }) => Boolean(r.city))
    .map((r: { city: string; country: string | null }) => ({
      city: r.city,
      country: r.country,
      label: cityLabel(r.city, r.country),
    }))
  return NextResponse.json({ cities })
}
