import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// FEAT-2608-036. Deliberately NOT using CityAutocomplete/Places API here -
// that endpoint is auth-gated specifically to stop anonymous traffic from
// hammering the billed Google quota (see comment in
// api/places/autocomplete/route.ts), and this location picker has to work
// for signed-out visitors too. Distinct city list off our own Venue table
// is free, public, and only ever offers cities we actually have venues
// in - which is the right scope for "near you", not the whole world.
export async function GET() {
  const rows = await prisma.venue.findMany({
    where: { isApproved: true },
    select: { city: true },
    distinct: ['city'],
    orderBy: { city: 'asc' },
  })
  const cities = rows.map((r: { city: string }) => r.city).filter(Boolean)
  return NextResponse.json({ cities })
}
