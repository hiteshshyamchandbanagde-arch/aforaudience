'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SiteNav from '@/components/SiteNav'
import { useToast } from '@/components/Toast'
import BrandLoader from '@/components/BrandLoader'
import MessageButton from '@/components/MessageButton'
import DashboardShell from '@/components/DashboardShell'
import { PageHead, Card, StatusPill, Button, IconCheck, IconX, ErrorBanner, type StatusPillTone } from '@/components/dashboard/VenuePortalUI'
import SharedButton from '@/components/ui/Button'
import { calendarDate, formatDate, istMonthKey } from '@/lib/format-date'
import { useLocale } from '@/lib/i18n/translate'

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
  const { locale, t: tr } = useLocale()
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

  if (status === 'loading' || loading) return (<><SiteNav /><DashboardShell><BrandLoader /></DashboardShell></>)
  if (!session) return (<><SiteNav /><DashboardShell>{null}</DashboardShell></>)

  const pending = bookings.filter((b) => b.status === 'PENDING')
  const resolved = bookings.filter((b) => b.status !== 'PENDING')

  // F3 - revenue summary. Gross amounts only (the rental fee the Organiser
  // pays), not netted against the platform's flat booking fee - that's a
  // separate, smaller number this view isn't trying to reconcile against.
  const confirmed = bookings.filter((b) => b.status === 'CONFIRMED')
  // BUG-2609-087 - by event date, and the month is India's: the device
  // zone would flip it at 5:30 am on the 1st for a UTC browser.
  const thisMonth = istMonthKey(new Date())
  const thisMonthRevenue = confirmed
    .filter((b) => istMonthKey(b.fromDate) === thisMonth)
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
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-page)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: 'var(--afa-space-48px) var(--afa-space-6) var(--afa-space-80px)' }}>
          <div>
            <PageHead
              eyebrow="Bookings & Revenue"
              title="Booking Requests"
              description="Revenue is gross rental income (not netted against the platform's flat booking fee). Multi-day bookings are marked on their start date only."
            />
          </div>

          {loadError && (
            <ErrorBanner style={{ marginBottom: 'var(--afa-space-6)' }}>{loadError}</ErrorBanner>
          )}

          {/* F3 - Revenue summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--afa-space-14px)', marginBottom: 'var(--afa-space-5)' }}>
            {[
              { label: 'This month', value: thisMonthRevenue, sub: tr.common.byEventDate },
              { label: 'Total confirmed', value: totalRevenue, sub: null },
              { label: 'Pending value', value: pendingValue, sub: null },
            ].map((s) => (
              <Card key={s.label} style={{ padding: 'var(--afa-space-18px) var(--afa-space-5)' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-micro)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--afa-text-muted)', margin: '0 0 var(--afa-space-2)' }}>{s.label}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-heading)', color: 'var(--afa-text-primary)', margin: 0 }}>₹{s.value.toLocaleString('en-IN')}</p>
                {s.sub && <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-muted)', margin: 'var(--afa-space-1) 0 0' }}>{s.sub}</p>}
              </Card>
            ))}
          </div>

          {/* F3 - Calendar */}
          <Card style={{ padding: 'var(--afa-space-5) var(--afa-space-6)', marginBottom: 'var(--afa-space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--afa-space-4)' }}>
              <SharedButton
                variant="icon"
                onClick={() => { setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)); setSelectedDay(null) }}
                style={{ fontSize: 'var(--afa-text-title)', color: 'var(--afa-text-secondary)', padding: 'var(--afa-space-1) var(--afa-space-2)' }}
              >
                ←
              </SharedButton>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--afa-text-title)', fontWeight: 500, color: 'var(--afa-text-primary)', margin: 0 }}>
                {formatDate(calendarDate(calendarMonth.getFullYear(), calendarMonth.getMonth()), 'monthYear', locale)}
              </p>
              <SharedButton
                variant="icon"
                onClick={() => { setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)); setSelectedDay(null) }}
                style={{ fontSize: 'var(--afa-text-title)', color: 'var(--afa-text-secondary)', padding: 'var(--afa-space-1) var(--afa-space-2)' }}
              >
                →
              </SharedButton>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--afa-space-1)', marginBottom: 'var(--afa-space-1)' }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-caption)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--afa-text-muted)', padding: 'var(--afa-space-1) 0' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--afa-space-1)' }}>
              {calendarCells.map((day, i) => {
                if (!day) return <div key={i} />
                const key = day.toDateString()
                const dayBookings = bookingsByDate[key] || []
                const isSelected = selectedDay === key
                return (
                  <SharedButton
                    // bare-reason: calendar day cell: a square grid cell sized by the 7-column grid, holding the date and status dots; not a button shape any variant describes
                    variant="bare"
                    key={i}
                    onClick={() => dayBookings.length > 0 && setSelectedDay(isSelected ? null : key)}
                    style={{
                      aspectRatio: '1', borderRadius: 'var(--afa-radius-md)', border: isSelected ? '1px solid var(--afa-selected-border)' : '1px solid var(--afa-tint-08)',
                      background: isSelected ? 'var(--afa-selected-bg)' : dayBookings.length > 0 ? 'var(--afa-tint-04)' : 'transparent',
                      cursor: dayBookings.length > 0 ? 'pointer' : 'default',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--afa-space-2px)', padding: 0,
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-small)', color: dayBookings.length > 0 ? 'var(--afa-text-primary)' : 'var(--afa-text-muted)' }}>{day.getDate()}</span>
                    {dayBookings.length > 0 && (
                      <div style={{ display: 'flex', gap: 'var(--afa-space-2px)' }}>
                        {dayBookings.slice(0, 3).map((b) => (
                          <span key={b.id} style={{ width: '5px', height: '5px', borderRadius: '50%', background: CAL_STATUS_DOT[b.status] }} />
                        ))}
                      </div>
                    )}
                  </SharedButton>
                )
              })}
            </div>

            {selectedDay && bookingsByDate[selectedDay] && (
              <div style={{ marginTop: 'var(--afa-space-4)', paddingTop: 'var(--afa-space-4)', borderTop: '1px solid var(--afa-tint-08)' }}>
                {bookingsByDate[selectedDay].map((b) => (
                  <div key={b.id} style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', padding: 'var(--afa-space-1) 0' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: CAL_STATUS_DOT[b.status], marginRight: 'var(--afa-space-6px)' }} />
                    {b.event?.title || 'Untitled event'} — {b.venue.name} · ₹{b.amount.toLocaleString('en-IN')} · <span style={{ color: 'var(--afa-text-secondary)' }}>{b.status.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Pending */}
          <div style={{ marginBottom: 'var(--afa-space-32px)' }}>
            <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 500, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-14px)' }}>
              Pending {pending.length > 0 && `(${pending.length})`}
            </h2>
            {pending.length === 0 ? (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-secondary)' }}>No pending booking requests.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-3)' }}>
                {pending.map((b) => (
                  <Card key={b.id} style={{ padding: 'var(--afa-space-5)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--afa-space-10px)', flexWrap: 'wrap', marginBottom: 'var(--afa-space-10px)' }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 'var(--afa-text-title)', color: 'var(--afa-text-primary)', margin: 0 }}>{b.event?.title || 'Untitled event'}</p>
                        <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-secondary)', marginTop: 'var(--afa-space-2px)' }}>
                          for {b.venue.name}, {b.venue.city} · requested by {b.organiser.orgName}
                        </p>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-title)', color: 'var(--afa-amber)' }}>₹{b.amount}</span>
                    </div>
                    <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-secondary)', marginBottom: 'var(--afa-space-4)' }}>
                      📅 {formatDate(b.fromDate, 'medium', locale)}
                      {b.fromDate !== b.toDate && ` – ${formatDate(b.toDate, 'medium', locale)}`}
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--afa-space-2)' }}>
                      <Button onClick={() => respond(b.id, 'CONFIRMED')} disabled={actingOn === b.id} style={{ padding: 'var(--afa-space-2) var(--afa-space-18px)', fontSize: 'var(--afa-text-ui)', opacity: actingOn === b.id ? 0.6 : 1 }}>
                        <IconCheck /> Confirm
                      </Button>
                      <Button variant="outline" onClick={() => respond(b.id, 'CANCELLED')} disabled={actingOn === b.id} style={{ padding: 'var(--afa-space-2) var(--afa-space-18px)', fontSize: 'var(--afa-text-ui)', opacity: actingOn === b.id ? 0.6 : 1 }}>
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
              <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 500, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-14px)' }}>
                Past Requests
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-10px)' }}>
                {resolved.map((b) => {
                  const tone = STATUS_TONE[b.status] || 'gold'
                  return (
                    <Card key={b.id} style={{ padding: 'var(--afa-space-4) var(--afa-space-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--afa-space-10px)' }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', margin: 0 }}>{b.event?.title || 'Untitled event'}</p>
                        <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-secondary)', marginTop: 'var(--afa-space-2px)' }}>{b.venue.name} · {b.organiser.orgName} · ₹{b.amount}</p>
                        {/* BUG-2608-091 - the booking's date (and end date if multi-day), same format as the Pending cards, so two past bookings of the same venue, organiser and amount can be told apart. */}
                        <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-secondary)', marginTop: 'var(--afa-space-2px)', marginBottom: 0 }}>
                          📅 {formatDate(b.fromDate, 'medium', locale)}
                          {b.fromDate !== b.toDate && ` – ${formatDate(b.toDate, 'medium', locale)}`}
                        </p>
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
      </DashboardShell>
    </>
  )
}
