'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import BrandLoader from '@/components/BrandLoader'
import { IN, AU, JP, SG, CA, US, GB, AE } from 'country-flag-icons/react/3x2'
import {
  PageHead, Card, StatusPill, EmptyState, ErrorBanner,
  IconVenue, IconEdit, IconChart, IconCalendar, IconTag, IconPlus, IconUsers, IconMap,
  primaryLinkStyle, outlineLinkStyle, navPillStyle, NavBadge,
} from '@/components/dashboard/VenuePortalUI'

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
  country?: string | null
  capacity: number
  isApproved: boolean
  createdAt: string
  seatingMode?: string
  seatMap?: { sections?: SeatSection[] } | null
  zonePrices?: { suggestedPrice: number | null }[]
  rateType?: 'HOURLY' | 'DAILY' | 'FLEXIBLE' | null
  hourlyRate?: number | null
  dailyRate?: number | null
}

// Same field-mismatch bug family as PR #151/#156: a NUMBERED venue's real
// pricing lives in VenueZonePrice (via the seat-map builder), not the GA
// path's seatMap.sections - reading only the latter showed "—" for every
// NUMBERED venue regardless of whether it was actually priced.
function priceRange(venue: Venue) {
  const prices =
    venue.seatingMode === 'NUMBERED'
      ? (venue.zonePrices || []).map((z) => Number(z.suggestedPrice) || 0).filter((p) => p > 0)
      : (venue.seatMap?.sections || []).map((s) => Number(s.price) || 0).filter((p) => p > 0)
  if (prices.length === 0) return '—'
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? `₹${min}` : `₹${min}–₹${max}`
}

function rateLabel(venue: Venue) {
  if (venue.rateType === 'HOURLY' && venue.hourlyRate) return `Hourly · ₹${venue.hourlyRate.toLocaleString('en-IN')}/hr`
  if (venue.rateType === 'DAILY' && venue.dailyRate) return `Daily · ₹${venue.dailyRate.toLocaleString('en-IN')}/day`
  return 'Flexible rate'
}

// BUG-2608-083: priceRange() is only meaningful for NUMBERED venues (real
// per-seat pricing lives in VenueZonePrice/seatMap.sections) - GA/Hourly/
// Daily/Flexible venues have no per-seat price at all, so this tile
// always showed a bare "—" for them. The actual rate for those venues is
// already surfaced below via rateLabel(); this tile just needs to show
// something venue-type-appropriate instead of a dash with no context.
function rateTypeLabel(venue: Venue) {
  if (venue.rateType === 'HOURLY') return 'Hourly'
  if (venue.rateType === 'DAILY') return 'Daily'
  return 'Flexible'
}

// Hitesh's call (23 Aug): every venue card gets a flag next to city,
// including India - not just non-India ones. venue.country is already
// present on every real venue via the Places-autocomplete-populated
// field (confirmed 100% coverage across current QA data: India 933,
// Australia/Japan/Singapore/Canada/US/UK ~30 each, UAE 29 - see
// GEN-2608-081's correction). Real SVG components (country-flag-icons),
// not Unicode emoji flags - emoji flags render as plain two-letter text
// (e.g. "JP") on Windows since merging the regional-indicator character
// pair into a flag glyph depends on OS font support, which Windows
// historically lacks/inconsistently provides (confirmed via Hitesh's
// live screenshot, BUG-2608-089). SVG guarantees identical rendering
// everywhere. Explicit map, not a lookup over the full 250+-country
// export, since the known country set is small and fixed for now;
// falls back to no flag (not a placeholder guess) for any value outside
// this set so a typo'd or future-added country doesn't render wrong.
const COUNTRY_FLAGS: Record<string, ComponentType<{ title?: string; className?: string; style?: CSSProperties }>> = {
  'India': IN,
  'Australia': AU,
  'Japan': JP,
  'Singapore': SG,
  'Canada': CA,
  'United States': US,
  'United Kingdom': GB,
  'United Arab Emirates': AE,
}

export default function VenueDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [venues, setVenues] = useState<Venue[]>([])
  const [pendingBookings, setPendingBookings] = useState(0)
  const [pendingFlexRequests, setPendingFlexRequests] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [venueStatus, setVenueStatus] = useState<{ isVenueOwner: boolean; hasProfile: boolean; isApproved: boolean } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const fetchVenueOwnerStatus = async () => {
      const res = await fetch('/api/venue-owners/status')
      if (res.ok) setVenueStatus(await res.json())
    }
    if (session?.user) fetchVenueOwnerStatus()
  }, [session])

  useEffect(() => {
    const fetchVenues = async () => {
      try {
        const res = await fetch('/api/venues/my-venues')
        if (!res.ok) throw new Error('Failed to fetch venues')
        const data = await res.json()
        setVenues(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    const fetchBookings = async () => {
      try {
        const res = await fetch('/api/venues/my-bookings')
        if (res.ok) {
          const data = await res.json()
          setPendingBookings(data.filter((b: any) => b.status === 'PENDING').length)
        }
      } catch {
        // Non-critical for this view; the dedicated bookings page will surface errors.
      }
    }

    // Same pending-count badge pattern as Booking Requests above, for the
    // Flexible-rate negotiation inbox - previously had no indicator at all,
    // so a pending request against a Flexible venue was easy to miss unless
    // the owner specifically thought to check this separate page.
    const fetchFlexRequests = async () => {
      try {
        const res = await fetch('/api/venue-booking-requests')
        if (res.ok) {
          const data = await res.json()
          setPendingFlexRequests(data.filter((r: any) => r.status === 'PENDING').length)
        }
      } catch {
        // Non-critical for this view; the dedicated requests page will surface errors.
      }
    }

    if (session?.user) {
      fetchVenues()
      fetchBookings()
      fetchFlexRequests()
    }
  }, [session])

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader /></>)
  if (!session) return <SiteNav />

  if (venueStatus && !venueStatus.isVenueOwner) {
    return (
      <>
        <SiteNav />
        <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', marginBottom: '12px' }}>You're not registered as a Venue Owner</h1>
            <p style={{ color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '24px' }}>Apply to list your venue from your profile to start managing bookings.</p>
            <BackLink href="/" label="Back to Home" />
          </div>
        </main>
      </>
    )
  }

  if (venueStatus && venueStatus.isVenueOwner && !venueStatus.isApproved) {
    return (
      <>
        <SiteNav />
        <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', marginBottom: '12px' }}>Your Venue Owner account is pending approval</h1>
            <p style={{ color: 'var(--afa-text-primary)', opacity: 0.6 }}>
              Our team reviews new Venue Owner applications before you can list a venue and accept bookings. We'll notify you as soon as you're approved.
            </p>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-page)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '48px 24px 80px' }}>
          <PageHead eyebrow="Portfolio" title="Your Venues">
            <Link href="/dashboard/venue/edit" className="avp-hover-border" style={navPillStyle}>
              <IconEdit size={16} /> Account Settings
            </Link>
            <Link href="/dashboard/venue/sales" className="avp-hover-border" style={navPillStyle}>
              <IconChart size={16} /> Revenue Overview
            </Link>
            <Link href="/dashboard/venue/bookings" className="avp-hover-border" style={navPillStyle}>
              <IconCalendar size={16} /> Booking Requests
              {pendingBookings > 0 && <NavBadge>{pendingBookings}</NavBadge>}
            </Link>
            <Link href="/dashboard/venue-requests" className="avp-hover-border" style={navPillStyle}>
              <IconTag size={16} /> Flexible Requests
              {pendingFlexRequests > 0 && <NavBadge>{pendingFlexRequests}</NavBadge>}
            </Link>
            <Link href="/dashboard/venue/create" className="avp-btn-primary" style={primaryLinkStyle}>
              <IconPlus /> Register Venue
            </Link>
          </PageHead>

          {error && (
            <ErrorBanner style={{ marginBottom: '24px' }}>{error}</ErrorBanner>
          )}

          {venues.length === 0 ? (
            <EmptyState
              icon={<IconVenue size={56} strokeWidth={1} />}
              caption="No venues yet — register your first space"
              action={
                <Link href="/dashboard/venue/create" className="avp-btn-primary" style={primaryLinkStyle}>
                  <IconPlus /> Register Venue
                </Link>
              }
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: '20px' }}>
              {venues.map((venue) => (
                <Card
                  key={venue.id}
                  onClick={() => router.push(`/dashboard/venue/${venue.id}`)}
                  style={{ display: 'flex', flexDirection: 'column', padding: '20px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '10px' }}>
                    {/* BUG-2608-085/087/088: fixed minHeight + line-clamped
                        title + 2-line-clamped (not 1-line-truncated)
                        address so cards in the same grid row start their
                        stats/actions rows at the same Y position
                        regardless of name/address length, while the full
                        address stays readable (Hitesh's call 23 Aug -
                        okay to wrap to 2 lines, not okay to hide it).
                        minWidth:0 required (BUG-2608-087) - flex items
                        default to min-width:auto and won't shrink below
                        content width otherwise, which silently defeats
                        the line-clamp/ellipsis below it. minHeight raised
                        92->118px to fit the address's 2nd line. */}
                    <div style={{ minHeight: '118px', minWidth: 0 }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--afa-amber)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {venue.country && COUNTRY_FLAGS[venue.country] && (() => {
                          const Flag = COUNTRY_FLAGS[venue.country]
                          return <Flag title={venue.country} style={{ width: '15px', height: 'auto', borderRadius: '2px', flexShrink: 0, boxShadow: '0 0 0 1px rgba(245,245,240,0.1)' }} />
                        })()}
                        {venue.city}
                      </p>
                      <h3
                        style={{
                          fontFamily: 'var(--font-display)', fontSize: '21px', fontWeight: 500, lineHeight: 1.2, color: 'var(--afa-text-primary)', margin: 0,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}
                      >
                        {venue.name}
                      </h3>
                      <p
                        style={{
                          fontSize: '12.5px', color: 'var(--afa-text-muted)', marginTop: '4px', lineHeight: 1.35,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}
                      >
                        {venue.address}
                      </p>
                    </div>
                    <StatusPill tone={venue.isApproved ? 'sage' : 'gold'}>{venue.isApproved ? 'Published' : 'Draft'}</StatusPill>
                  </div>

                  <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid rgba(245,245,240,0.08)', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <IconUsers size={16} style={{ color: 'rgba(201,151,58,0.8)' }} />
                      <div>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', color: 'var(--afa-text-primary)', margin: 0 }}>{venue.capacity}</p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--afa-text-muted)', margin: 0 }}>Capacity</p>
                      </div>
                    </div>
                    {venue.seatingMode === 'NUMBERED' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <IconTag size={16} style={{ color: 'rgba(201,151,58,0.8)' }} />
                        <div>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', color: 'var(--afa-text-primary)', margin: 0 }}>{priceRange(venue)}</p>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--afa-text-muted)', margin: 0 }}>Per seat</p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <IconTag size={16} style={{ color: 'rgba(201,151,58,0.8)' }} />
                        <div>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', color: 'var(--afa-text-primary)', margin: 0 }}>{rateTypeLabel(venue)}</p>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--afa-text-muted)', margin: 0 }}>Rate Type</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <p style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--afa-amber)', marginTop: '14px', marginBottom: 0 }}>{rateLabel(venue)}</p>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }} onClick={(e) => e.stopPropagation()}>
                    <Link href={`/dashboard/venue/${venue.id}`} className="avp-btn-outline" style={{ ...outlineLinkStyle, flex: 1, padding: '9px 0', fontSize: '13px' }}>
                      View
                    </Link>
                    <Link href={`/dashboard/venue/${venue.id}/edit`} className="avp-btn-primary" style={{ ...primaryLinkStyle, flex: 1, padding: '9px 0', fontSize: '13px' }}>
                      Edit
                    </Link>
                    {venue.seatingMode === 'NUMBERED' && (
                      <Link href={`/dashboard/venue/${venue.id}/seat-map`} className="avp-btn-outline" style={{ ...outlineLinkStyle, flex: 1, padding: '9px 0', fontSize: '13px' }}>
                        <IconMap size={14} />
                      </Link>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}


