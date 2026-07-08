'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'

interface BookingRequest {
  id: string
  fromDate: string
  toDate: string
  amount: number
  status: string
  createdAt: string
  venue: { id: string; name: string; city: string }
  organiser: { orgName: string }
  event: { id: string; title: string; date: string } | null
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: 'rgba(201,151,58,0.15)', color: '#8a6a1f' },
  CONFIRMED: { bg: 'rgba(74,103,65,0.12)', color: '#4A6741' },
  CANCELLED: { bg: 'rgba(179,38,30,0.1)', color: '#B3261E' },
  REFUNDED: { bg: 'rgba(14,12,10,0.08)', color: '#0E0C0A' },
}

export default function VenueBookingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<BookingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actingOn, setActingOn] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchBookings = async () => {
    try {
      const res = await fetch('/api/venues/my-bookings')
      if (!res.ok) throw new Error('Failed to fetch booking requests')
      const data = await res.json()
      setBookings(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchBookings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const respond = async (bookingId: string, newStatus: 'CONFIRMED' | 'CANCELLED') => {
    setActingOn(bookingId)
    try {
      const res = await fetch(`/api/venue-bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update booking')
      await fetchBookings()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActingOn(null)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />

  const pending = bookings.filter((b) => b.status === 'PENDING')
  const resolved = bookings.filter((b) => b.status !== 'PENDING')

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px' }}>
          <Link href="/dashboard/venue" style={{ fontSize: '14px', color: '#C8441A', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Venues
          </Link>

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginTop: '16px', marginBottom: '6px' }}>
            Booking Requests
          </h1>
          <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6, marginBottom: '32px' }}>
            Organisers requesting to book your venues.
          </p>

          {error && (
            <div style={{ padding: '14px 16px', background: '#FDECEA', border: '1px solid #F5C2C0', borderRadius: '8px', color: '#B3261E', fontSize: '14px', marginBottom: '24px' }}>
              {error}
            </div>
          )}

          {/* Pending */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '14px' }}>
              Pending {pending.length > 0 && `(${pending.length})`}
            </h2>
            {pending.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.5 }}>No pending booking requests.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pending.map((b) => (
                  <div key={b.id} style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '16px', color: '#0E0C0A' }}>{b.event?.title || 'Untitled event'}</p>
                        <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6 }}>
                          for {b.venue.name}, {b.venue.city} · requested by {b.organiser.orgName}
                        </p>
                      </div>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: '#C8441A' }}>₹{b.amount}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '14px' }}>
                      📅 {new Date(b.fromDate).toLocaleDateString()}
                      {b.fromDate !== b.toDate && ` – ${new Date(b.toDate).toLocaleDateString()}`}
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => respond(b.id, 'CONFIRMED')}
                        disabled={actingOn === b.id}
                        style={{ fontSize: '13px', fontWeight: 600, color: '#F7F3EE', background: '#4A6741', border: 'none', borderRadius: '6px', padding: '8px 18px', cursor: 'pointer', opacity: actingOn === b.id ? 0.6 : 1 }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => respond(b.id, 'CANCELLED')}
                        disabled={actingOn === b.id}
                        style={{ fontSize: '13px', fontWeight: 600, color: '#B3261E', background: 'transparent', border: '1px solid rgba(179,38,30,0.3)', borderRadius: '6px', padding: '8px 18px', cursor: 'pointer', opacity: actingOn === b.id ? 0.6 : 1 }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resolved */}
          {resolved.length > 0 && (
            <div>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '14px' }}>
                Past Requests
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {resolved.map((b) => {
                  const st = STATUS_STYLE[b.status] || STATUS_STYLE.PENDING
                  return (
                    <div key={b.id} style={{ background: '#fff', borderRadius: '10px', padding: '16px 20px', border: '1px solid rgba(14,12,10,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '14px', color: '#0E0C0A' }}>{b.event?.title || 'Untitled event'}</p>
                        <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6 }}>{b.venue.name} · {b.organiser.orgName} · ₹{b.amount}</p>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', padding: '4px 10px', borderRadius: '999px', background: st.bg, color: st.color }}>
                        {b.status.toLowerCase()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
