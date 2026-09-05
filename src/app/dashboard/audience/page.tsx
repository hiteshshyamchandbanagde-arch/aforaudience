'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactElement } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'
import DashboardShell from '@/components/DashboardShell'
import { useLocale } from '@/lib/i18n/translate'

function StatTile({ label, value, icon, sub }: { label: string; value: string; icon: 'creditCard' | 'calendar' | 'gift'; sub?: string }) {
  const icons: Record<string, ReactElement> = {
    creditCard: (
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    calendar: (
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    gift: (
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" />
        <line x1="12" y1="22" x2="12" y2="7" />
        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
      </svg>
    ),
  }
  return (
    <div style={{ background: 'var(--afa-surface-raised)', border: '1px solid rgba(245,245,240,0.06)' }} className="rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <span style={{ color: 'var(--afa-text-primary)', opacity: 0.6, fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ color: 'var(--afa-amber)', backgroundColor: 'rgba(201,151,58,0.12)' }} className="w-8 h-8 rounded-lg flex items-center justify-center">
          {icons[icon]}
        </span>
      </div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, color: 'var(--afa-text-primary)', lineHeight: 1 }}>{value}</div>
      {sub && <p style={{ color: 'var(--afa-text-primary)', opacity: 0.5, fontSize: 12, marginTop: 6 }}>{sub}</p>}
    </div>
  )
}

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
      <DashboardShell>
        <div style={{ minHeight: '100vh', background: 'var(--afa-surface-page)', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '900px', padding: '48px 24px' }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '6px' }}>
              {tr.audienceActivityPage.heading}
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '32px' }}>
              {tr.audienceActivityPage.subtitle}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ marginBottom: '16px' }}>
              <StatTile label={tr.audienceActivityPage.totalSpend} value={`₹${totalSpend.toLocaleString('en-IN')}`} icon="creditCard" />
              <StatTile label={tr.audienceActivityPage.eventsAttended} value={String(totalEventsAttended)} icon="calendar" />
              <StatTile label={tr.audienceActivityPage.freeEventsAttended} value={String(freeEventsAttended)} icon="gift" />
            </div>
            <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.4, marginBottom: '24px' }}>
              {tr.audienceActivityPage.tipsNote}
            </p>

            {confirmed.length === 0 && (
              <div style={{ background: 'var(--afa-surface-raised)', borderRadius: '12px', padding: '28px', border: '1px solid rgba(245,245,240,0.06)', textAlign: 'center', marginBottom: '24px' }}>
                <p style={{ fontSize: '14px', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: '16px' }}>
                  {tr.audienceActivityPage.noConfirmedBookings}
                </p>
                <Link href="/events" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-amber)', textDecoration: 'none' }}>
                  {tr.audienceActivityPage.browseEvents}
                </Link>
              </div>
            )}
          </div>
        </div>
      </DashboardShell>
    </>
  )
}
