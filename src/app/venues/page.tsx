import React from 'react'
import { cookies, headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import SiteNav from '@/components/SiteNav'
import VenuesViewToggle from './VenuesViewToggle'
import VenuesHero from './VenuesHero'
import { authOptions } from '@/lib/auth'
import { resolveLocation } from '@/lib/location'

// Without this, Next.js has no dynamic API (cookies/headers/searchParams) to
// signal that this page needs per-request data, so it can statically render
// this page at build time and keep serving that frozen snapshot - meaning
// newly published venues would never show up until the next deploy.
export const dynamic = 'force-dynamic'

async function getVenues() {
  try {
    const venues = await prisma.venue.findMany({
      where: { isApproved: true },
      orderBy: { createdAt: 'desc' },
      include: {
        // Same field-mismatch bug family as PR #151/#156: a NUMBERED
        // venue's real pricing lives in VenueZonePrice, not the GA path's
        // seatMap.sections - without this, every NUMBERED venue's card
        // shows no price range regardless of whether it's actually priced.
        zonePrices: { select: { suggestedPrice: true } },
      },
    })
    return venues
  } catch (err) {
    console.error('Failed to fetch venues:', err)
    return []
  }
}

function priceRange(venue: { seatingMode?: string; seatMap: unknown; zonePrices?: { suggestedPrice: number | null }[] }) {
  const prices =
    venue.seatingMode === 'NUMBERED'
      ? (venue.zonePrices || []).map((z) => Number(z.suggestedPrice) || 0).filter((p) => p > 0)
      : ((venue.seatMap as { sections?: { price?: number }[] } | null)?.sections || [])
          .map((s) => Number(s.price) || 0)
          .filter((p) => p > 0)
  if (prices.length === 0) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? `₹${min}` : `₹${min}–₹${max}`
}

export default async function VenuesPage() {
  const venues = await getVenues()

  // FEAT-2608-036 - resolved server-side (profile choice / cookie /
  // this-request IP-geo guess) and passed down as the initial city
  // filter value. Same "pre-filled, always removable" pattern as the
  // Events page - VenuesGridClient's dropdown still defaults to "All
  // Cities" as an option and the person can pick it any time.
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

  return (
    <main style={{ minHeight: '100vh', background: 'var(--afa-cream)', fontFamily: 'var(--font-sans)' }}>
      <SiteNav active="venues" />
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px' }}>
        <VenuesHero />

        <VenuesViewToggle
          venues={venues.map((v) => ({
            id: v.id,
            name: v.name,
            city: v.city,
            country: v.country,
            capacity: v.capacity,
            priceRangeLabel: priceRange(v),
            // photos is a plain scalar column on Venue, already returned
            // by the default findMany (no top-level `select` in
            // getVenues) - the redesigned card (FEAT-2608-044) is the
            // first thing on this page to actually render it.
            photos: v.photos,
          }))}
          defaultCity={resolved.city}
        />
      </div>
    </main>
  )
}
