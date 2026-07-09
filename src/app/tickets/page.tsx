'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'

interface BookingItem {
  id: string
  seats: Record<string, number>
  totalAmount: number
  status: string
  createdAt: string
  event: {
    id: string
    title: string
    date: string
    startTime: string
    venue: { name: string; city: string } | null
  }
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PENDING: { bg: 'rgba(201,151,58,0.15)', color: '#8a6a1f', label: 'Reserved — payment pending' },
  CONFIRMED: { bg: 'rgba(74,103,65,0.12)', color: '#4A6741', label: 'Confirmed' },
  CANCELLED: { bg: 'rgba(179,38,30,0.1)', color: '#B3261E', label: 'Cancelled' },
  REFUNDED: { bg: 'rgba(14,12,10,0.08)', color: '#0E0C0A', label: 'Refunded' },
}

export default function MyTicketsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/bookings/my')
        if (!res.ok) throw new Error('Failed to load your tickets')
        setBookings(await res.json())
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

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 24px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginBottom: '8px' }}>
            My Tickets
          </h1>
          <p style={{ fontSize: '15px', color: '#0E0C0A', opacity: 0.6, marginBottom: '32px' }}>
            Online payment isn't live yet, so tickets here are reservations, not confirmed purchases — we'll email you when checkout opens.
          </p>

          {error && (
            <div style={{ padding: '14px 16px', background: '#FDECEA', border: '1px solid #F5C2C0', borderRadius: '8px', color: '#B3261E', fontSize: '14px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {bookings.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '12px', padding: '40px', textAlign: 'center', border: '1px solid rgba(14,12,10,0.08)', color: '#0E0C0A', opacity: 0.6 }}>
              No tickets yet. <Link href="/events" style={{ color: '#C8441A', fontWeight: 600 }}>Browse events</Link>
            </div>
          ) : (
            bookings.map((b) => {
              const s = STATUS_STYLE[b.status] || STATUS_STYLE.PENDING
              return (
                <div key={b.id} style={{ background: '#fff', borderRadius: '12px', padding: '20px 22px', marginBottom: '14px', border: '1px solid rgba(14,12,10,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <Link href={`/events/${b.event.id}`} style={{ fontSize: '16px', fontWeight: 600, color: '#0E0C0A', textDecoration: 'none' }}>
                      {b.event.title}
                    </Link>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
                      {s.label}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, margin: '0 0 10px' }}>
                    {new Date(b.event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {b.event.startTime}
                    {b.event.venue && <> · {b.event.venue.name}, {b.event.venue.city}</>}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#0E0C0A' }}>
                    <span>{Object.entries(b.seats).map(([section, qty]) => `${qty} × ${section}`).join(', ')}</span>
                    <span style={{ fontWeight: 600 }}>{b.totalAmount > 0 ? `₹${b.totalAmount.toLocaleString('en-IN')}` : 'Free'}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </main>
    </>
  )
}
