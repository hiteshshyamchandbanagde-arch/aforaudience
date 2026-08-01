import React from 'react'
import prisma from '@/lib/prisma'
import SiteNav from '@/components/SiteNav'
import VenuesViewToggle from './VenuesViewToggle'

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

  return (
    <main style={{ minHeight: '100vh', background: 'var(--afa-cream)', fontFamily: 'system-ui, sans-serif' }}>
      <SiteNav active="venues" />
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '8px' }}>
          Venues
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '32px' }}>
          Spaces hosting live art near you.
        </p>

        <VenuesViewToggle
          venues={venues.map((v) => ({
            id: v.id,
            name: v.name,
            city: v.city,
            capacity: v.capacity,
            priceRangeLabel: priceRange(v),
          }))}
        />
      </div>
    </main>
  )
}
