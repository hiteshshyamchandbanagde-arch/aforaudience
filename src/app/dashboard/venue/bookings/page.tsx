'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import { useToast } from '@/components/Toast'
import BrandLoader from '@/components/BrandLoader'
import MessageButton from '@/components/MessageButton'
import { PageHead, Card, StatusPill, Button, IconCheck, IconX, type StatusPillTone } from '@/components/dashboard/VenuePortalUI'

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

const STATUS_TONE: Record<string, StatusPillTone> = {
  PENDING: 'gold',
  CONFIRMED: 'sage',
  CANCELLED: 'error',
  REFUNDED: 'muted',
}

export default function VenueBookingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<BookingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const { showToast } = useToast()
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
      setLoadError(err.message)
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
      showToast(newStatus === 'CONFIRMED' ? 'Booking confirmed.' : 'Booking rejected.', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to update booking', 'error')
    } finally {
      setActingOn(null)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader /></>)
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
    PENDING: 'var(--afa-amber)',
    CONFIRMED: 'var(--afa-sage)',
    CANCELLED: 'var(--afa-error)',
    REFUNDED: 'var(--afa-gray-taupe)',
  }

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-page)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 24px 80px' }}>
          <BackLink href="/dashboard/venue" label="Back to Venues" />

          <div style={{ marginTop: '20px' }}>
            <PageHead
              eyebrow="Bookings & Revenue"
              title="Booking Requests"
              description="Revenue is gross rental income (not netted against the platform's flat booking fee). Multi-day bookings are marked on their start date only."
            />
          </div>

          {loadError && (
            <div style={{ padding: '14px 16px', background: 'var(--afa-error-bg)', border: '1px solid var(--afa-error-border)', borderRadius: '8px', color: 'var(--afa-error)', fontSize: '14px', marginBottom: '24px' }}>
              {loadError}
            </div>
          )}

          {/* F3 - Revenue summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            {[
              { label: 'This month', value: thisMonthRevenue },
              { label: 'Total confirmed', value: totalRevenue },
              { label: 'Pending value', value: pendingValue },
            ].map((s) => (
              <Card key={s.label} style={{ padding: '18px 20px' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--afa-text-muted)', margin: '0 0 8px' }}>{s.label}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: 'var(--afa-text-primary)', margin: 0 }}>₹{s.value.toLocaleString('en-IN')}</p>
              </Card>
            ))}
          </div>

          {/* F3 - Calendar */}
          <Card style={{ padding: '20px 24px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <button
                onClick={() => { setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)); setSelectedDay(null) }}
                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'var(--afa-text-secondary)', padding: '4px 8px' }}
              >
                ←
              </button>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 500, color: 'var(--afa-text-primary)', margin: 0 }}>
                {calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
              <button
                onClick={() => { setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)); setSelectedDay(null) }}
                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'var(--afa-text-secondary)', padding: '4px 8px' }}
              >
                →
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--afa-text-muted)', padding: '4px 0' }}>{d}</div>
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
                      aspectRatio: '1', borderRadius: '8px', border: isSelected ? '1px solid var(--afa-amber)' : '1px solid rgba(245,245,240,0.08)',
                      background: isSelected ? 'rgba(201,151,58,0.1)' : dayBookings.length > 0 ? 'rgba(245,245,240,0.03)' : 'transparent',
                      cursor: dayBookings.length > 0 ? 'pointer' : 'default',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', padding: 0,
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: dayBookings.length > 0 ? 'var(--afa-text-primary)' : 'var(--afa-text-muted)' }}>{day.getDate()}</span>
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
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(245,245,240,0.08)' }}>
                {bookingsByDate[selectedDay].map((b) => (
                  <div key={b.id} style={{ fontSize: '13px', color: 'var(--afa-text-primary)', padding: '4px 0' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: CAL_STATUS_DOT[b.status], marginRight: '6px' }} />
                    {b.event?.title || 'Untitled event'} — {b.venue.name} · ₹{b.amount.toLocaleString('en-IN')} · <span style={{ color: 'var(--afa-text-secondary)' }}>{b.status.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Pending */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '19px', fontWeight: 500, color: 'var(--afa-text-primary)', marginBottom: '14px' }}>
              Pending {pending.length > 0 && `(${pending.length})`}
            </h2>
            {pending.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'var(--afa-text-muted)' }}>No pending booking requests.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pending.map((b) => (
                  <Card key={b.id} style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '16px', color: 'var(--afa-text-primary)', margin: 0 }}>{b.event?.title || 'Untitled event'}</p>
                        <p style={{ fontSize: '13px', color: 'var(--afa-text-secondary)', marginTop: '2px' }}>
                          for {b.venue.name}, {b.venue.city} · requested by {b.organiser.orgName}
                        </p>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '17px', color: 'var(--afa-amber)' }}>₹{b.amount}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--afa-text-secondary)', marginBottom: '16px' }}>
                      📅 {new Date(b.fromDate).toLocaleDateString()}
                      {b.fromDate !== b.toDate && ` – ${new Date(b.toDate).toLocaleDateString()}`}
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button onClick={() => respond(b.id, 'CONFIRMED')} disabled={actingOn === b.id} style={{ padding: '8px 18px', fontSize: '13px', opacity: actingOn === b.id ? 0.6 : 1 }}>
                        <IconCheck /> Confirm
                      </Button>
                      <Button variant="outline" onClick={() => respond(b.id, 'CANCELLED')} disabled={actingOn === b.id} style={{ padding: '8px 18px', fontSize: '13px', opacity: actingOn === b.id ? 0.6 : 1 }}>
                        <IconX /> Reject
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Resolved */}
          {resolved.length > 0 && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '19px', fontWeight: 500, color: 'var(--afa-text-primary)', marginBottom: '14px' }}>
                Past Requests
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {resolved.map((b) => {
                  const tone = STATUS_TONE[b.status] || 'gold'
                  return (
                    <Card key={b.id} style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--afa-text-primary)', margin: 0 }}>{b.event?.title || 'Untitled event'}</p>
                        <p style={{ fontSize: '13px', color: 'var(--afa-text-secondary)', marginTop: '2px' }}>{b.venue.name} · {b.organiser.orgName} · ₹{b.amount}</p>
                      </div>
                      <StatusPill tone={tone}>{b.status.toLowerCase()}</StatusPill>
                      {b.status === 'CONFIRMED' && (
                        <MessageButton contextType="VENUE_BOOKING" contextId={b.id} label="Message Organiser" />
                      )}
                    </Card>
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
