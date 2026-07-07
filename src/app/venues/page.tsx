import React from 'react'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import SiteNav from '@/components/SiteNav'

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
    })
    return venues
  } catch (err) {
    console.error('Failed to fetch venues:', err)
    return []
  }
}

function priceRange(seatMap: unknown) {
  const sections = (seatMap as { sections?: { price?: number }[] } | null)?.sections || []
  const prices = sections.map((s) => Number(s.price) || 0).filter((p) => p > 0)
  if (prices.length === 0) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? `₹${min}` : `₹${min}–₹${max}`
}

export default async function VenuesPage() {
  const venues = await getVenues()

  return (
    <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
      <SiteNav active="venues" />
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginBottom: '8px' }}>
          Venues
        </h1>
        <p style={{ fontSize: '15px', color: '#0E0C0A', opacity: 0.6, marginBottom: '32px' }}>
          Spaces hosting live art near you.
        </p>

        {venues.length === 0 ? (
          <p style={{ fontSize: '15px', color: '#0E0C0A', opacity: 0.6 }}>No venues found yet. Check back soon!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {venues.map((v) => {
              const range = priceRange(v.seatMap)
              return (
                <Link
                  key={v.id}
                  href={`/venues/${v.id}`}
                  style={{ display: 'block', background: '#fff', borderRadius: '12px', padding: '22px', border: '1px solid rgba(14,12,10,0.08)', textDecoration: 'none' }}
                >
                  <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '19px', fontWeight: 700, color: '#0E0C0A', marginBottom: '4px' }}>
                    {v.name}
                  </h2>
                  <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '14px' }}>{v.city}</p>
                  <div style={{ display: 'flex', gap: '18px', fontSize: '13px', color: '#0E0C0A' }}>
                    <span><strong>{v.capacity}</strong> seats</span>
                    {range && <span style={{ color: '#C8441A', fontWeight: 700 }}>{range}</span>}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
