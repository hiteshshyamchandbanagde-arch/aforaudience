'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import { useToast } from '@/components/Toast'

interface SeatSection {
  id: string
  name: string
  seats: number
  price: number
}

interface Venue {
  id: string
  name: string
  address: string
  city: string
  capacity: number
  acousticRating?: number
  facilities: string[]
  seatMap?: { sections?: SeatSection[] } | null
  seatingMode?: 'GENERAL_ADMISSION' | 'NUMBERED'
  seats?: { tierLabel: string }[]
  zonePrices?: { level: string; zoneName: string; suggestedPrice: number | null }[]
  isApproved: boolean
  createdAt: string
}

export default function VenueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [venue, setVenue] = useState<Venue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toggling, setToggling] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchVenue = async () => {
    try {
      const res = await fetch(`/api/venues/${id}/owner`)
      if (!res.ok) {
        if (res.status === 403) throw new Error('You do not have access to this venue')
        throw new Error('Venue not found')
      }
      const data = await res.json()
      setVenue(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchVenue()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id])

  const togglePublish = async () => {
    if (!venue) return
    setToggling(true)
    try {
      const res = await fetch(`/api/venues/${venue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish: !venue.isApproved }),
      })
      const data = await res.json()
      // The server already gives a specific, actionable message (e.g. the
      // publish-gate reason for NUMBERED venues) - a hardcoded generic
      // string here was throwing that away. Surfacing via toast instead of
      // the page-level `error` state, since that state blanks the entire
      // page (looked like a navigation/redirect, not an inline error).
      if (!res.ok) throw new Error(data.error || 'Failed to update publish status')
      setVenue(data)
      showToast(data.isApproved ? 'Venue published.' : 'Venue unpublished.', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to update publish status', 'error')
    } finally {
      setToggling(false)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />
  if (error) return (<><SiteNav /><div style={{ padding: '32px', color: 'var(--afa-error)' }}>{error}</div></>)
  if (!venue) return (<><SiteNav /><div style={{ padding: '32px' }}>Venue not found</div></>)

  const sections = venue.seatMap?.sections || []

  // NUMBERED venues have no seatMap.sections - their zones live in real
  // Seat/VenueZonePrice rows instead (same data event-creation pricing
  // reads). Grouping by level+zoneName so same-named zones on different
  // levels stay distinct, consistent with the design.md §9 zone model.
  const numberedZones = (() => {
    if (venue.seatingMode !== 'NUMBERED' || !venue.seats) return []
    const counts = new Map<string, { level: string; zoneName: string; count: number }>()
    for (const seat of venue.seats) {
      const key = seat.tierLabel
      const existing = counts.get(key)
      if (existing) existing.count += 1
      else counts.set(key, { level: '', zoneName: seat.tierLabel, count: 1 })
    }
    const priceByZone = new Map<string, number | null>()
    for (const zp of venue.zonePrices || []) {
      priceByZone.set(`${zp.level}::${zp.zoneName}`, zp.suggestedPrice)
    }
    return Array.from(counts.values()).map((z) => ({
      ...z,
      price: priceByZone.get(`${z.level}::${z.zoneName}`) ?? null,
    }))
  })()
  const prices = sections.map((s) => Number(s.price) || 0).filter((p) => p > 0)
  const minPrice = prices.length ? Math.min(...prices) : null
  const maxPrice = prices.length ? Math.max(...prices) : null

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-cream)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
          <Link href="/dashboard/venue" style={{ fontSize: '14px', color: 'var(--afa-terracotta)', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Venues
          </Link>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '16px', marginBottom: '28px', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '6px' }}>
                {venue.name}
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--afa-ink)', opacity: 0.6 }}>
                {venue.address}, {venue.city}
              </p>
            </div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '6px 14px',
                borderRadius: '999px',
                background: venue.isApproved ? 'rgba(74,103,65,0.12)' : 'rgba(201,151,58,0.15)',
                color: venue.isApproved ? 'var(--afa-sage)' : 'var(--afa-gold)',
                whiteSpace: 'nowrap',
              }}
            >
              {venue.isApproved ? 'Published' : 'Draft'}
            </span>
          </div>

          {error && (
            <div style={{ padding: '14px 16px', background: 'var(--afa-error-bg)', border: '1px solid var(--afa-error-border)', borderRadius: '8px', color: 'var(--afa-error)', fontSize: '14px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          <div style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.5, marginBottom: '4px' }}>Total Capacity</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--afa-ink)' }}>{venue.capacity} seats</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.5, marginBottom: '4px' }}>Price Range</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--afa-ink)' }}>
                  {minPrice !== null ? (minPrice === maxPrice ? `₹${minPrice}` : `₹${minPrice}–₹${maxPrice}`) : '—'}
                </p>
              </div>
              {venue.acousticRating != null && (
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.5, marginBottom: '4px' }}>Acoustic Rating</p>
                  <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--afa-ink)' }}>{venue.acousticRating}/5</p>
                </div>
              )}
            </div>

            {venue.facilities && venue.facilities.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '10px' }}>Facilities</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {venue.facilities.map((facility) => (
                    <span key={facility} style={{ fontSize: '13px', padding: '5px 12px', background: 'var(--afa-cream)', borderRadius: '999px', color: 'var(--afa-ink)' }}>
                      {facility}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '10px' }}>Seating Sections</h2>
              {venue.seatingMode === 'NUMBERED' ? (
                numberedZones.length === 0 ? (
                  <p style={{ fontSize: '14px', color: 'var(--afa-ink)', opacity: 0.5 }}>
                    No seat map built yet — use Seat Map Builder to add zones and seats.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {numberedZones.map((z) => (
                      <div
                        key={`${z.level}::${z.zoneName}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          background: 'var(--afa-cream)',
                          borderRadius: '8px',
                          fontSize: '14px',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--afa-ink)' }}>
                          {z.zoneName}{z.level ? ` · ${z.level}` : ''}
                        </span>
                        <span style={{ color: 'var(--afa-ink)', opacity: 0.7 }}>{z.count} seats</span>
                        <span style={{ fontWeight: 700, color: 'var(--afa-terracotta)' }}>
                          {z.price ? `₹${z.price}` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : sections.length === 0 ? (
                <p style={{ fontSize: '14px', color: 'var(--afa-ink)', opacity: 0.5 }}>No seating sections defined yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sections.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: 'var(--afa-cream)',
                        borderRadius: '8px',
                        fontSize: '14px',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--afa-ink)' }}>{s.name}</span>
                      <span style={{ color: 'var(--afa-ink)', opacity: 0.7 }}>{s.seats} seats</span>
                      <span style={{ fontWeight: 700, color: 'var(--afa-terracotta)' }}>₹{s.price}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link
              href={`/dashboard/venue/${venue.id}/edit`}
              style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-cream)', background: 'var(--afa-ink)', textDecoration: 'none', padding: '12px 24px', borderRadius: '8px' }}
            >
              Edit Venue
            </Link>
            <Link
              href={`/dashboard/venue/${venue.id}/sales`}
              style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-ink)', background: 'transparent', border: '1px solid rgba(14,12,10,0.2)', textDecoration: 'none', padding: '12px 24px', borderRadius: '8px' }}
            >
              📊 Revenue
            </Link>
            <button
              onClick={togglePublish}
              disabled={toggling}
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: venue.isApproved ? 'var(--afa-ink)' : 'var(--afa-cream)',
                background: venue.isApproved ? 'transparent' : 'var(--afa-terracotta)',
                border: venue.isApproved ? '1px solid rgba(14,12,10,0.2)' : 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                opacity: toggling ? 0.6 : 1,
              }}
            >
              {toggling ? 'Updating...' : venue.isApproved ? 'Unpublish' : 'Publish Venue'}
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
