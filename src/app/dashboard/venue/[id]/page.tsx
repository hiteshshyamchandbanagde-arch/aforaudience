'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import { useToast } from '@/components/Toast'
import BrandLoader from '@/components/BrandLoader'

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
  state?: string | null
  country?: string | null
  capacity: number
  acousticRating?: number
  facilities: string[]
  seatMap?: { sections?: SeatSection[] } | null
  seatingMode?: 'GENERAL_ADMISSION' | 'NUMBERED'
  seats?: { tierLabel: string; level: string }[]
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

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader /></>)
  if (!session) return <SiteNav />
  if (error) return (<><SiteNav /><div style={{ padding: '32px', color: 'var(--afa-error)' }}>{error}</div></>)
  if (!venue) return (<><SiteNav /><div style={{ padding: '32px' }}>Venue not found</div></>)

  const sections = venue.seatMap?.sections || []

  // NUMBERED venues have no seatMap.sections - their zones live in real
  // Seat/VenueZonePrice rows instead (same data event-creation pricing
  // reads). Grouping by level+zoneName (not zoneName alone) so same-named
  // zones on different levels stay distinct rows with their own price -
  // found live (28 Jul) that this was previously merging them into one
  // row and always showing the level='' (Main) price for every level.
  const numberedZones = (() => {
    if (venue.seatingMode !== 'NUMBERED' || !venue.seats) return []
    const counts = new Map<string, { level: string; zoneName: string; count: number }>()
    for (const seat of venue.seats) {
      const key = `${seat.level}::${seat.tierLabel}`
      const existing = counts.get(key)
      if (existing) existing.count += 1
      else counts.set(key, { level: seat.level, zoneName: seat.tierLabel, count: 1 })
    }
    const priceByZone = new Map<string, number | null>()
    for (const zp of venue.zonePrices || []) {
      priceByZone.set(`${zp.level}::${zp.zoneName}`, zp.suggestedPrice)
    }
    return Array.from(counts.values())
      .sort((a, b) => a.level.localeCompare(b.level) || a.zoneName.localeCompare(b.zoneName))
      .map((z) => ({
        ...z,
        price: priceByZone.get(`${z.level}::${z.zoneName}`) ?? null,
      }))
  })()
  // Price Range stat box: same gap as the zone-list fix above missed -
  // numberedZones already resolves real per-zone prices for NUMBERED
  // venues, but this summary number was still reading GA-only `sections`
  // only, showing "—" even when zones were fully priced.
  const prices =
    venue.seatingMode === 'NUMBERED'
      ? numberedZones.map((z) => Number(z.price) || 0).filter((p) => p > 0)
      : sections.map((s) => Number(s.price) || 0).filter((p) => p > 0)
  const minPrice = prices.length ? Math.min(...prices) : null
  const maxPrice = prices.length ? Math.max(...prices) : null

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
          <BackLink href="/dashboard/venue" label="Back to Venues" />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '16px', marginBottom: '28px', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '6px' }}>
                {venue.name}
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--afa-text-primary)', opacity: 0.6 }}>
                {venue.address}, {venue.city}{venue.state ? `, ${venue.state}` : ''}
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

          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(245,245,240,0.08)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: '4px' }}>Total Capacity</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{venue.capacity} seats</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: '4px' }}>Price Range</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--afa-text-primary)' }}>
                  {minPrice !== null ? (minPrice === maxPrice ? `₹${minPrice}` : `₹${minPrice}–₹${maxPrice}`) : '—'}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: '4px' }}>Acoustic Rating</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--afa-text-primary)' }}>Not Rated Yet</p>
              </div>
            </div>

            {venue.facilities && venue.facilities.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '10px' }}>Facilities</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {venue.facilities.map((facility) => (
                    <span key={facility} style={{ fontSize: '13px', padding: '5px 12px', background: 'var(--afa-surface-raised)', borderRadius: '999px', color: 'var(--afa-text-primary)' }}>
                      {facility}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '10px' }}>Seating Sections</h2>
              {venue.seatingMode === 'NUMBERED' ? (
                numberedZones.length === 0 ? (
                  <p style={{ fontSize: '14px', color: 'var(--afa-text-primary)', opacity: 0.5 }}>
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
                          background: 'var(--afa-surface-raised)',
                          borderRadius: '8px',
                          fontSize: '14px',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--afa-text-primary)' }}>
                          {z.zoneName}{z.level ? ` · ${z.level}` : ''}
                        </span>
                        <span style={{ color: 'var(--afa-text-primary)', opacity: 0.7 }}>{z.count} seats</span>
                        <span style={{ fontWeight: 700, color: 'var(--afa-terracotta)' }}>
                          {z.price === null ? (
                            '—'
                          ) : z.price > 0 ? (
                            `₹${z.price}`
                          ) : (
                            // Rule (Hitesh, 27 Jul): ₹0 is a valid,
                            // explicit "Free" zone now - must read as
                            // intentional, not as "—" (which means
                            // "never priced" here) or a broken price.
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: 'var(--afa-amber)',
                                background: 'var(--afa-amber-tint)',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                letterSpacing: '0.02em',
                              }}
                            >
                              FREE
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : sections.length === 0 ? (
                <p style={{ fontSize: '14px', color: 'var(--afa-text-primary)', opacity: 0.5 }}>No seating sections defined yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sections.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: 'var(--afa-surface-raised)',
                        borderRadius: '8px',
                        fontSize: '14px',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--afa-text-primary)' }}>{s.name}</span>
                      <span style={{ color: 'var(--afa-text-primary)', opacity: 0.7 }}>{s.seats} seats</span>
                      <span style={{ fontWeight: 700, color: 'var(--afa-terracotta)' }}>
                        {Number(s.price) > 0 ? (
                          `₹${s.price}`
                        ) : (
                          // Rule (Hitesh, 27 Jul): a ₹0 price must read as
                          // an intentional "Free" section to anyone
                          // viewing the venue, not as a blank/broken
                          // price field - same fix as the owner-side
                          // SeatSectionEditor.
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: 'var(--afa-amber)',
                              background: 'var(--afa-amber-tint)',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              letterSpacing: '0.02em',
                            }}
                          >
                            FREE
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link
              href={`/dashboard/venue/${venue.id}/edit`}
              style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-fill-solid)', textDecoration: 'none', padding: '12px 24px', borderRadius: '8px' }}
            >
              Edit Venue
            </Link>
            <Link
              href={`/dashboard/venue/${venue.id}/sales`}
              style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-text-primary)', background: 'transparent', border: '1px solid rgba(245,245,240,0.2)', textDecoration: 'none', padding: '12px 24px', borderRadius: '8px' }}
            >
              📊 Revenue
            </Link>
            <button
              onClick={togglePublish}
              disabled={toggling}
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: venue.isApproved ? 'var(--afa-text-primary)' : 'var(--afa-on-fill-solid)',
                background: venue.isApproved ? 'transparent' : 'var(--afa-terracotta)',
                border: venue.isApproved ? '1px solid rgba(245,245,240,0.2)' : 'none',
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
