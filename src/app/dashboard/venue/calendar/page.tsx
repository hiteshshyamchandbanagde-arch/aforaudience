'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'

interface ConfirmedBooking {
  id: string
  amount: number
  fromDate: string
  toDate: string
  venue: { name: string; city: string }
  event: { title: string } | null
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function VenueRevenuePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [thisMonthRevenue, setThisMonthRevenue] = useState(0)
  const [bookings, setBookings] = useState<ConfirmedBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/venues/revenue')
        if (!res.ok) throw new Error('Failed to load revenue data')
        const data = await res.json()
        setTotalRevenue(data.totalRevenue)
        setThisMonthRevenue(data.thisMonthRevenue)
        setBookings(data.confirmedBookings)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    if (session?.user) load()
  }, [session])

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />

  // Month grid math
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDayOfWeek).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  const bookingsOnDay = (day: number) =>
    bookings.filter((b) => isSameDate(new Date(b.fromDate), new Date(year, month, day)))

  const monthBookings = bookings.filter((b) => {
    const d = new Date(b.fromDate)
    return d.getFullYear() === year && d.getMonth() === month
  })

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
          <Link href="/dashboard/venue" style={{ fontSize: '14px', color: '#C8441A', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Venues
          </Link>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginTop: '16px', marginBottom: '24px' }}>
            Revenue &amp; Calendar
          </h1>

          {error && (
            <div style={{ padding: '14px 16px', background: '#FDECEA', border: '1px solid #F5C2C0', borderRadius: '8px', color: '#B3261E', fontSize: '14px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {/* Revenue stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '28px' }}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <div style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.55, marginBottom: '6px' }}>Total Confirmed Revenue</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: 700, color: '#0E0C0A' }}>₹{totalRevenue.toLocaleString('en-IN')}</div>
            </div>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <div style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.55, marginBottom: '6px' }}>This Month</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: 700, color: '#C8441A' }}>₹{thisMonthRevenue.toLocaleString('en-IN')}</div>
            </div>
          </div>
          <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.45, marginBottom: '28px' }}>
            Only confirmed bookings count here — pending requests aren't revenue until you confirm them.
          </p>

          {/* Calendar */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid rgba(14,12,10,0.08)', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <button
                onClick={() => setViewMonth(new Date(year, month - 1, 1))}
                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#0E0C0A', padding: '4px 8px' }}
              >
                ‹
              </button>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: 700, color: '#0E0C0A' }}>
                {viewMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </div>
              <button
                onClick={() => setViewMonth(new Date(year, month + 1, 1))}
                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#0E0C0A', padding: '4px 8px' }}
              >
                ›
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
              {DAY_LABELS.map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: '11px', color: '#0E0C0A', opacity: 0.45, fontWeight: 600 }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {cells.map((day, i) => {
                const dayBookings = day ? bookingsOnDay(day) : []
                const hasBooking = dayBookings.length > 0
                return (
                  <div
                    key={i}
                    title={dayBookings.map((b) => b.event?.title || b.venue.name).join(', ')}
                    style={{
                      aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '6px', fontSize: '12px', color: day ? '#0E0C0A' : 'transparent',
                      background: hasBooking ? 'rgba(200,68,26,0.12)' : 'transparent',
                      border: hasBooking ? '1px solid rgba(200,68,26,0.3)' : 'none',
                    }}
                  >
                    <span>{day || ''}</span>
                    {hasBooking && <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#C8441A', marginTop: '2px' }} />}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Agenda for this month */}
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#0E0C0A', marginBottom: '12px' }}>
            Confirmed this month
          </h2>
          {monthBookings.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', textAlign: 'center', border: '1px solid rgba(14,12,10,0.08)', color: '#0E0C0A', opacity: 0.5, fontSize: '14px' }}>
              No confirmed bookings this month.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {monthBookings.map((b) => (
                <div key={b.id} style={{ background: '#fff', borderRadius: '10px', padding: '14px 18px', border: '1px solid rgba(14,12,10,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#0E0C0A' }}>{b.event?.title || 'Untitled event'}</div>
                    <div style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.6 }}>
                      {b.venue.name}, {b.venue.city} · {new Date(b.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#4A6741' }}>₹{b.amount.toLocaleString('en-IN')}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
