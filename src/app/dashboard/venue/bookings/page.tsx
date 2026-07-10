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
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

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

  // F3 - revenue summary. Gross amounts only (the rental fee the Organiser
  // pays), not netted against the platform's flat booking fee - that's a
  // separate, smaller number this view isn't trying to reconcile against.
  const confirmed = bookings.filter((b) => b.status === 'CONFIRMED')
  const now = new Date()
  const thisMonthRevenue = confirmed
    .filter((b) => {
      const d = new Date(b.fromDate)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, b) => sum + b.amount, 0)
  const totalRevenue = confirmed.reduce((sum, b) => sum + b.amount, 0)
  const pendingValue = pending.reduce((sum, b) => sum + b.amount, 0)

  // F3 - month calendar. Multi-day (Daily-rate) bookings are only marked
  // on their start date (fromDate) for simplicity, not every day they span.
  const bookingsByDate: Record<string, BookingRequest[]> = {}
  bookings.forEach((b) => {
    const key = new Date(b.fromDate).toDateString()
    if (!bookingsByDate[key]) bookingsByDate[key] = []
    bookingsByDate[key].push(b)
  })

  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
  const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0)
  const leadingBlanks = monthStart.getDay()
  const daysInMonth = monthEnd.getDate()
  const calendarCells: (Date | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), i + 1)),
  ]

  const CAL_STATUS_DOT: Record<string, string> = {
    PENDING: '#C9973A',
    CONFIRMED: '#4A6741',
    CANCELLED: '#B3261E',
    REFUNDED: '#8a877e',
  }

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px' }}>
          <Link href="/dashboard/venue" style={{ fontSize: '14px', color: '#C8441A', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Venues
          </Link>

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginTop: '16px', marginBottom: '6px' }}>
            Bookings, Revenue &amp; Calendar
          </h1>
          <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6, marginBottom: '32px' }}>
            Revenue is gross rental income (not netted against the platform's flat booking fee). Multi-day bookings are marked on their start date only.
          </p>

          {error && (
            <div style={{ padding: '14px 16px', background: '#FDECEA', border: '1px solid #F5C2C0', borderRadius: '8px', color: '#B3261E', fontSize: '14px', marginBottom: '24px' }}>
              {error}
            </div>
          )}

          {/* F3 - Revenue summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '32px' }}>
            {[
              { label: 'This month', value: thisMonthRevenue },
              { label: 'Total confirmed', value: totalRevenue },
              { label: 'Pending value', value: pendingValue },
            ].map((s) => (
              <div key={s.label} style={{ background: '#fff', borderRadius: '12px', padding: '18px 20px', border: '1px solid rgba(14,12,10,0.08)' }}>
                <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>{s.label}</p>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: 700, color: '#0E0C0A', margin: 0 }}>₹{s.value.toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>

          {/* F3 - Calendar */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px 24px', border: '1px solid rgba(14,12,10,0.08)', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <button
                onClick={() => { setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)); setSelectedDay(null) }}
                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#0E0C0A', opacity: 0.6, padding: '4px 8px' }}
              >
                ←
              </button>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: '17px', fontWeight: 700, color: '#0E0C0A', margin: 0 }}>
                {calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
              <button
                onClick={() => { setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)); setSelectedDay(null) }}
                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#0E0C0A', opacity: 0.6, padding: '4px 8px' }}
              >
                →
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#0E0C0A', opacity: 0.4, padding: '4px 0' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {calendarCells.map((day, i) => {
                if (!day) return <div key={i} />
                const key = day.toDateString()
                const dayBookings = bookingsByDate[key] || []
                const isSelected = selectedDay === key
                return (
                  <button
                    key={i}
                    onClick={() => dayBookings.length > 0 && setSelectedDay(isSelected ? null : key)}
                    style={{
                      aspectRatio: '1', borderRadius: '8px', border: isSelected ? '2px solid #C8441A' : '1px solid rgba(14,12,10,0.06)',
                      background: isSelected ? 'rgba(200,68,26,0.06)' : '#fff', cursor: dayBookings.length > 0 ? 'pointer' : 'default',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', padding: 0,
                    }}
                  >
                    <span style={{ fontSize: '13px', color: '#0E0C0A' }}>{day.getDate()}</span>
                    {dayBookings.length > 0 && (
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {dayBookings.slice(0, 3).map((b) => (
                          <span key={b.id} style={{ width: '5px', height: '5px', borderRadius: '50%', background: CAL_STATUS_DOT[b.status] }} />
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {selectedDay && bookingsByDate[selectedDay] && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(14,12,10,0.06)' }}>
                {bookingsByDate[selectedDay].map((b) => (
                  <div key={b.id} style={{ fontSize: '13px', color: '#0E0C0A', padding: '4px 0' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: CAL_STATUS_DOT[b.status], marginRight: '6px' }} />
                    {b.event?.title || 'Untitled event'} — {b.venue.name} · ₹{b.amount.toLocaleString('en-IN')} · <span style={{ opacity: 0.6 }}>{b.status.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

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
