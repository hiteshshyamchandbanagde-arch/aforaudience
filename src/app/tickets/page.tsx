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
  expiresAt: string | null
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
  PENDING: { bg: 'rgba(201,151,58,0.15)', color: 'var(--afa-gold)', label: 'Reserved — pay to confirm' },
  EXPIRED: { bg: 'rgba(14,12,10,0.08)', color: 'var(--afa-ink)', label: 'Expired — book again' },
  CONFIRMED: { bg: 'rgba(74,103,65,0.12)', color: 'var(--afa-sage)', label: 'Confirmed' },
  CANCELLED: { bg: 'rgba(179,38,30,0.1)', color: 'var(--afa-error)', label: 'Cancelled' },
  REFUNDED: { bg: 'rgba(14,12,10,0.08)', color: 'var(--afa-ink)', label: 'Refunded' },
}

// A booking's display status can differ from its DB status: an expired
// PENDING is functionally dead even though the row still says PENDING.
function effectiveStatus(b: BookingItem): string {
  if (b.status === 'PENDING' && b.expiresAt && new Date(b.expiresAt) < new Date()) {
    return 'EXPIRED'
  }
  return b.status
}

export default function MyTicketsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

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

  useEffect(() => {
    if (session?.user) load()
  }, [session])

  const cancelBooking = async (id: string) => {
    setCancelling(id)
    setError('')
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: 'PATCH' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to cancel')
      }
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCancelling(null)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-cream)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 24px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '8px' }}>
            My Tickets
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '32px' }}>
            Reserved bookings need to be paid to lock in your seats. Confirmed bookings are yours.
          </p>

          {error && (
            <div style={{ padding: '14px 16px', background: 'var(--afa-error-bg)', border: '1px solid var(--afa-error-border)', borderRadius: '8px', color: 'var(--afa-error)', fontSize: '14px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {bookings.length === 0 ? (
            <div style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '40px', textAlign: 'center', border: '1px solid rgba(14,12,10,0.08)', color: 'var(--afa-ink)', opacity: 0.6 }}>
              No tickets yet. <Link href="/events" style={{ color: 'var(--afa-terracotta)', fontWeight: 600 }}>Browse events</Link>
            </div>
          ) : (
            bookings.map((b) => {
              const eff = effectiveStatus(b)
              const s = STATUS_STYLE[eff] || STATUS_STYLE.PENDING
              const isLivePending = eff === 'PENDING'
              return (
                <div key={b.id} style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '20px 22px', marginBottom: '14px', border: '1px solid rgba(14,12,10,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <Link href={`/events/${b.event.id}`} style={{ fontSize: '16px', fontWeight: 600, color: 'var(--afa-ink)', textDecoration: 'none' }}>
                      {b.event.title}
                    </Link>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
                      {s.label}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, margin: '0 0 10px' }}>
                    {new Date(b.event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {b.event.startTime}
                    {b.event.venue && <> · {b.event.venue.name}, {b.event.venue.city}</>}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--afa-ink)' }}>
                    <span>{Object.entries(b.seats).map(([section, qty]) => `${qty} × ${section}`).join(', ')}</span>
                    <span style={{ fontWeight: 600 }}>{b.totalAmount > 0 ? `₹${b.totalAmount.toLocaleString('en-IN')}` : 'Free'}</span>
                  </div>
                  {isLivePending && (
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {b.totalAmount > 0 && (
                        <Link
                          href={`/checkout/${b.id}`}
                          style={{ fontSize: '12px', fontWeight: 700, color: 'white', background: 'var(--afa-terracotta)', border: 'none', borderRadius: '6px', padding: '6px 14px', textDecoration: 'none' }}
                        >
                          Pay now →
                        </Link>
                      )}
                      <button
                        onClick={() => cancelBooking(b.id)}
                        disabled={cancelling === b.id}
                        style={{ fontSize: '12px', fontWeight: 600, color: 'var(--afa-error)', background: 'transparent', border: '1px solid var(--afa-error-border)', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', opacity: cancelling === b.id ? 0.6 : 1 }}
                      >
                        {cancelling === b.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    </div>
                  )}
                  {eff === 'CONFIRMED' && (
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <a
                        href={`/api/bookings/${b.id}/ticket`}
                        style={{ fontSize: '12px', fontWeight: 700, color: 'white', background: 'var(--afa-ink)', border: 'none', borderRadius: '6px', padding: '6px 14px', textDecoration: 'none' }}
                      >
                        Download ticket (PDF)
                      </a>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </main>
    </>
  )
}
