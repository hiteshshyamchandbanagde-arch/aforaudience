import { NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { resolveLocation, locationCookieValue, LOCATION_COOKIE, LOCATION_COOKIE_OPTIONS } from '@/lib/location'

// FEAT-2608-036. GET resolves the current best-known location (profile >
// cookie > this-request IP-geo guess) and, if it had to fall back to a
// fresh IP-geo guess, writes the cookie so the next request skips
// straight to the cheap cookie read. POST is the only path that ever
// touches User.defaultCity - see comment on that column in schema.prisma
// for why auto-detection deliberately never persists there on its own.
export async function GET() {
  const session = await getServerSession(authOptions)
  let profileCity: string | null = null
  let profileLat: number | null = null
  let profileLng: number | null = null
  let profileCountry: string | null = null

  if (session?.user) {
    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
      select: { defaultCity: true, defaultCityLat: true, defaultCityLng: true, defaultCountry: true },
    })
    if (user?.defaultCity) {
      profileCity = user.defaultCity
      profileLat = user.defaultCityLat
      profileLng = user.defaultCityLng
      profileCountry = user.defaultCountry
    }
  }

  const cookieStore = await cookies()
  const headerStore = await headers()
  const resolved = await resolveLocation({ profileCity, profileLat, profileLng, profileCountry, cookieStore, headerStore })

  const res = NextResponse.json(resolved)
  if (resolved.source === 'detected' && resolved.city) {
    res.cookies.set(LOCATION_COOKIE, locationCookieValue(resolved.city, resolved.lat, resolved.lng, resolved.country), LOCATION_COOKIE_OPTIONS)
  }
  return res
}

export async function POST(req: Request) {
  const { city, lat, lng, country } = await req.json()
  if (typeof city !== 'string' || !city.trim()) {
    return NextResponse.json({ error: 'city is required' }, { status: 400 })
  }
  const cleanCity = city.trim()
  const cleanLat = typeof lat === 'number' ? lat : null
  const cleanLng = typeof lng === 'number' ? lng : null
  const cleanCountry = typeof country === 'string' && country.trim() ? country.trim() : null

  const session = await getServerSession(authOptions)
  if (session?.user) {
    await prisma.user.update({
      where: { id: (session.user as any).id },
      data: { defaultCity: cleanCity, defaultCityLat: cleanLat, defaultCityLng: cleanLng, defaultCountry: cleanCountry },
    })
  }

  // Cookie set regardless of login state - keeps guest and logged-in
  // behaviour consistent, and covers a logged-in user on a device where
  // reading the session is briefly stale.
  const res = NextResponse.json({ ok: true, city: cleanCity, lat: cleanLat, lng: cleanLng, country: cleanCountry })
  res.cookies.set(LOCATION_COOKIE, locationCookieValue(cleanCity, cleanLat, cleanLng, cleanCountry), LOCATION_COOKIE_OPTIONS)
  return res
}
