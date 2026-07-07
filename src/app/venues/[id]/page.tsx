import React from 'react'
import prisma from '@/lib/prisma'
import SiteNav from '@/components/SiteNav'

// See src/app/venues/page.tsx for why this is needed.
export const dynamic = 'force-dynamic'

interface SeatSection {
  id: string
  name: string
  seats: number
  price: number
}

async function getVenue(id: string) {
  try {
    return await prisma.venue.findUnique({ where: { id } })
  } catch (err) {
    console.error('Failed to fetch venue:', err)
    return null
  }
}

export default async function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const venue = await getVenue(id)

  if (!venue || !venue.isApproved) {
    return (
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <SiteNav backHref="/venues" backLabel="← Back to Venues" />
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>Venue not found.</div>
      </main>
    )
  }

  const sections = (venue.seatMap as { sections?: SeatSection[] } | null)?.sections || []

  return (
    <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
      <SiteNav backHref="/venues" backLabel="← Back to Venues" />
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
          {venue.name}
        </h1>
        <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6, marginBottom: '28px' }}>
          {venue.address}, {venue.city}
        </p>

        <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', border: '1px solid rgba(14,12,10,0.08)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div>
              <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginBottom: '4px' }}>Total Capacity</p>
              <p style={{ fontSize: '24px', fontWeight: 700, color: '#0E0C0A' }}>{venue.capacity} seats</p>
            </div>
            {venue.acousticRating != null && (
              <div>
                <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginBottom: '4px' }}>Acoustic Rating</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: '#0E0C0A' }}>{venue.acousticRating}/5</p>
              </div>
            )}
          </div>

          {venue.facilities && venue.facilities.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0E0C0A', marginBottom: '10px' }}>Facilities</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {venue.facilities.map((facility) => (
                  <span key={facility} style={{ fontSize: '13px', padding: '5px 12px', background: '#F7F3EE', borderRadius: '999px', color: '#0E0C0A' }}>
                    {facility}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0E0C0A', marginBottom: '10px' }}>Seating & Pricing</h2>
            {sections.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.5 }}>Seating details coming soon.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sections.map((s) => (
                  <div
                    key={s.id}
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#F7F3EE', borderRadius: '8px', fontSize: '14px' }}
                  >
                    <span style={{ fontWeight: 600, color: '#0E0C0A' }}>{s.name}</span>
                    <span style={{ color: '#0E0C0A', opacity: 0.7 }}>{s.seats} seats</span>
                    <span style={{ fontWeight: 700, color: '#C8441A' }}>₹{s.price}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
