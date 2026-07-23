'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
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
  capacity: number
  isApproved: boolean
  createdAt: string
  seatMap?: { sections?: SeatSection[] } | null
}

function priceRange(venue: Venue) {
  const prices = (venue.seatMap?.sections || []).map((s) => Number(s.price) || 0).filter((p) => p > 0)
  if (prices.length === 0) return '—'
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? `₹${min}` : `₹${min}–₹${max}`
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
        <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', marginBottom: '12px' }}>You're not registered as a Venue Owner</h1>
            <p style={{ color: '#0E0C0A', opacity: 0.6, marginBottom: '24px' }}>Apply to list your venue from your profile to start managing bookings.</p>
            <Link href="/" style={{ color: '#C8441A', fontWeight: 600, textDecoration: 'none' }}>Back to Home</Link>
          </div>
        </main>
      </>
    )
  }

  if (venueStatus && venueStatus.isVenueOwner && !venueStatus.isApproved) {
    return (
      <>
        <SiteNav />
        <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', marginBottom: '12px' }}>Your Venue Owner account is pending approval</h1>
            <p style={{ color: '#0E0C0A', opacity: 0.6 }}>
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
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
                Your Venues
              </h1>
              <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6 }}>Manage your venue listings, seating, and pricing</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link
                href="/dashboard/venue/sales"
                style={{ fontSize: '14px', fontWeight: 600, color: '#0E0C0A', background: 'transparent', border: '1px solid rgba(14,12,10,0.2)', textDecoration: 'none', padding: '12px 22px', borderRadius: '8px' }}
              >
                📊 Revenue Overview
              </Link>
              <Link
                href="/dashboard/venue/bookings"
                style={{ position: 'relative', fontSize: '14px', fontWeight: 600, color: '#0E0C0A', background: 'transparent', border: '1px solid rgba(14,12,10,0.2)', textDecoration: 'none', padding: '12px 22px', borderRadius: '8px' }}
              >
                Booking Requests
                {pendingBookings > 0 && (
                  <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#C8441A', color: '#F7F3EE', fontSize: '11px', fontWeight: 700, borderRadius: '999px', padding: '2px 7px' }}>
                    {pendingBookings}
                  </span>
                )}
              </Link>
              <Link
                href="/dashboard/venue-requests"
                style={{ position: 'relative', fontSize: '14px', fontWeight: 600, color: '#0E0C0A', background: 'transparent', border: '1px solid rgba(14,12,10,0.2)', textDecoration: 'none', padding: '12px 22px', borderRadius: '8px' }}
              >
                Flexible Requests
                {pendingFlexRequests > 0 && (
                  <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#C8441A', color: '#F7F3EE', fontSize: '11px', fontWeight: 700, borderRadius: '999px', padding: '2px 7px' }}>
                    {pendingFlexRequests}
                  </span>
                )}
              </Link>
              <Link
                href="/dashboard/venue/create"
                style={{ fontSize: '14px', fontWeight: 600, color: '#F7F3EE', background: '#C8441A', textDecoration: 'none', padding: '12px 22px', borderRadius: '8px' }}
              >
                + Register Venue
              </Link>
            </div>
          </div>

          {error && (
            <div style={{ padding: '14px 16px', background: '#FDECEA', border: '1px solid #F5C2C0', borderRadius: '8px', color: '#B3261E', fontSize: '14px', marginBottom: '24px' }}>
              {error}
            </div>
          )}

          {venues.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 24px', background: '#fff', borderRadius: '12px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <p style={{ fontSize: '17px', color: '#0E0C0A', marginBottom: '8px' }}>No venues yet</p>
              <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6, marginBottom: '20px' }}>Register your first venue to start hosting events</p>
              <Link
                href="/dashboard/venue/create"
                style={{ fontSize: '14px', fontWeight: 600, color: '#F7F3EE', background: '#C8441A', textDecoration: 'none', padding: '12px 24px', borderRadius: '8px' }}
              >
                Register Venue
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {venues.map((venue) => (
                <div key={venue.id} style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid rgba(14,12,10,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '10px' }}>
                    <div>
                      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '19px', fontWeight: 700, color: '#0E0C0A' }}>{venue.name}</h3>
                      <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginTop: '2px' }}>{venue.address}, {venue.city}</p>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '5px 10px',
                        borderRadius: '999px',
                        background: venue.isApproved ? 'rgba(74,103,65,0.12)' : 'rgba(201,151,58,0.15)',
                        color: venue.isApproved ? '#4A6741' : '#8a6a1f',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {venue.isApproved ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '20px', marginBottom: '18px', fontSize: '13px', color: '#0E0C0A' }}>
                    <span><strong>{venue.capacity}</strong> seats</span>
                    <span><strong>{priceRange(venue)}</strong> per seat</span>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <Link
                      href={`/dashboard/venue/${venue.id}`}
                      style={{ flex: 1, textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#0E0C0A', border: '1px solid rgba(14,12,10,0.15)', textDecoration: 'none', padding: '9px 0', borderRadius: '8px' }}
                    >
                      View
                    </Link>
                    <Link
                      href={`/dashboard/venue/${venue.id}/edit`}
                      style={{ flex: 1, textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#F7F3EE', background: '#0E0C0A', textDecoration: 'none', padding: '9px 0', borderRadius: '8px' }}
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/dashboard/venue/${venue.id}/seat-map`}
                      style={{ flex: 1, textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#0E0C0A', border: '1px solid rgba(14,12,10,0.15)', textDecoration: 'none', padding: '9px 0', borderRadius: '8px' }}
                    >
                      Seat Map
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
