'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'

interface BookingItem {
  id: string
  totalAmount: number
  status: string
  createdAt: string
  event: {
    id: string
    title: string
    date: string
    isFree: boolean
  }
}

export default function AudienceActivityPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/bookings/my')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load your activity')
        return res.json()
      })
      .then(setBookings)
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false))
  }, [session])

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />
  if (error) return (<><SiteNav /><div style={{ padding: '32px', color: '#B3261E' }}>{error}</div></>)

  const confirmed = bookings.filter((b) => b.status === 'CONFIRMED')
  const totalSpend = confirmed.reduce((sum, b) => sum + b.totalAmount, 0)
  const freeEventsAttended = confirmed.filter((b) => b.event.isFree).length
  const totalEventsAttended = confirmed.length

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
            My Activity
          </h1>
          <p style={{ fontSize: '15px', color: '#0E0C0A', opacity: 0.6, marginBottom: '32px' }}>
            Your spend and event history on AforAudience.
          </p>

          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '24px', border: '1px solid rgba(14,12,10,0.08)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '20px' }}>
              <div>
                <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginBottom: '4px' }}>Total Spend</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: '#0E0C0A' }}>₹{totalSpend.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginBottom: '4px' }}>Events Attended</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: '#0E0C0A' }}>{totalEventsAttended}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginBottom: '4px' }}>Free Events Attended</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: '#0E0C0A' }}>{freeEventsAttended}</p>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.4, marginTop: '18px' }}>
              Tips you've given will show here once tipping is available.
            </p>
          </div>

          {confirmed.length === 0 && (
            <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', border: '1px solid rgba(14,12,10,0.08)', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.5, marginBottom: '16px' }}>
                No confirmed bookings yet.
              </p>
              <Link href="/events" style={{ fontSize: '14px', fontWeight: 600, color: '#C8441A', textDecoration: 'none' }}>
                Browse events →
              </Link>
            </div>
          )}

          <Link href="/tickets" style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, textDecoration: 'none' }}>
            ← View all my tickets
          </Link>
        </div>
      </main>
    </>
  )
}
