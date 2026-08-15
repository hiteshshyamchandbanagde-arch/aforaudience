'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'
import { useLocale } from '@/lib/i18n/translate'

interface BookingItem {
  id: string
  totalAmount: number
  status: string
  createdAt: string
  checkedInAt: string | null
  event: {
    id: string
    title: string
    date: string
    isFree: boolean
  }
}

export default function AudienceActivityPage() {
  const { t: tr } = useLocale()
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
        if (!res.ok) throw new Error(tr.audienceActivityPage.failedToLoad)
        return res.json()
      })
      .then(setBookings)
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false))
  }, [session])

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader /></>)
  if (!session) return <SiteNav />
  if (error) return (<><SiteNav /><div style={{ padding: '32px', color: 'var(--afa-error)' }}>{error}</div></>)

  const confirmed = bookings.filter((b) => b.status === 'CONFIRMED')
  const totalSpend = confirmed.reduce((sum, b) => sum + b.totalAmount, 0)
  // BUG-2608-048 (15 Aug): "Events Attended" previously counted every
  // CONFIRMED booking, including ones for events that haven't happened
  // yet or that the person no-showed for - a paid/reserved seat, not an
  // actual attendance. Scoped to real check-ins (checkedInAt set) so this
  // reads as attendance history, not a booking count (that's what My
  // Tickets is for).
  const attended = confirmed.filter((b) => b.checkedInAt)
  const freeEventsAttended = attended.filter((b) => b.event.isFree).length
  const totalEventsAttended = attended.length

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-cream)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '6px' }}>
            {tr.audienceActivityPage.heading}
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '32px' }}>
            {tr.audienceActivityPage.subtitle}
          </p>

          <div style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', marginBottom: '24px', border: '1px solid rgba(14,12,10,0.08)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '20px' }}>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.5, marginBottom: '4px' }}>{tr.audienceActivityPage.totalSpend}</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--afa-ink)' }}>₹{totalSpend.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.5, marginBottom: '4px' }}>{tr.audienceActivityPage.eventsAttended}</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--afa-ink)' }}>{totalEventsAttended}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.5, marginBottom: '4px' }}>{tr.audienceActivityPage.freeEventsAttended}</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--afa-ink)' }}>{freeEventsAttended}</p>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.4, marginTop: '18px' }}>
              {tr.audienceActivityPage.tipsNote}
            </p>
          </div>

          {confirmed.length === 0 && (
            <div style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', border: '1px solid rgba(14,12,10,0.08)', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: 'var(--afa-ink)', opacity: 0.5, marginBottom: '16px' }}>
                {tr.audienceActivityPage.noConfirmedBookings}
              </p>
              <Link href="/events" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-terracotta)', textDecoration: 'none' }}>
                {tr.audienceActivityPage.browseEvents}
              </Link>
            </div>
          )}

          <Link href="/tickets" style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, textDecoration: 'none' }}>
            {tr.audienceActivityPage.viewAllTickets}
          </Link>
        </div>
      </main>
    </>
  )
}
