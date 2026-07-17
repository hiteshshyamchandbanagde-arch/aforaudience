'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use, useCallback, useRef, ReactNode } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'

interface TimelinePoint {
  date: string
  revenue: number
}

interface RecentBooking {
  id: string
  organiserName: string
  eventTitle: string | null
  fromDate: string
  toDate: string
  amount: number
  createdAt: string
}

interface VenueSalesData {
  venue: { id: string; name: string; city: string; capacity: number }
  totals: {
    grossRevenue: number
    confirmedBookingsCount: number
    upcomingCount: number
    completedCount: number
    pendingCount: number
    pendingValue: number
  }
  timeline: TimelinePoint[]
  recentBookings: RecentBooking[]
  generatedAt: string
}

const POLL_MS = 20000

const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

function timeAgo(iso: string) {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export default function VenueSalesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<VenueSalesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchSales = useCallback(async () => {
    try {
      const res = await fetch(`/api/venues/${id}/sales`)
      if (!res.ok) {
        if (res.status === 403) throw new Error('You do not have access to this venue')
        throw new Error('Could not load revenue data')
      }
      const json = await res.json()
      setData(json)
      setRefreshedAt(new Date())
      setError('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchSales()
    pollRef.current = setInterval(fetchSales, POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [status, fetchSales])

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />
  if (error && !data) return (<><SiteNav /><div style={{ padding: '32px', color: '#B3261E' }}>{error}</div></>)
  if (!data) return (<><SiteNav /><div style={{ padding: '32px' }}>No data</div></>)

  const { venue, totals, timeline, recentBookings } = data
  const maxTimelineRevenue = Math.max(1, ...timeline.map((t) => t.revenue))

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px' }}>
          <Link href={`/dashboard/venue/${id}`} style={{ fontSize: '14px', color: '#C8441A', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to venue
          </Link>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '12px', marginBottom: '28px', flexWrap: 'wrap', gap: '8px' }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '30px', fontWeight: 700, color: '#0E0C0A' }}>
              📊 {venue.name} — Revenue
            </h1>
            <span style={{ fontSize: '12px', color: 'rgba(14,12,10,0.5)' }}>
              {refreshedAt ? `Updated ${timeAgo(refreshedAt.toISOString())} · refreshes every 20s` : ''}
            </span>
          </div>

          {error && (
            <div style={{ fontSize: '13px', color: '#B3261E', marginBottom: '16px' }}>{error} (showing last good data)</div>
          )}

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '28px' }}>
            <SummaryCard label="Gross Revenue" value={money(totals.grossRevenue)} sub="from confirmed bookings, no platform cut" />
            <SummaryCard label="Confirmed Bookings" value={String(totals.confirmedBookingsCount)} sub={`${totals.upcomingCount} upcoming · ${totals.completedCount} completed`} />
            <SummaryCard
              label="Pending (awaiting confirmation)"
              value={String(totals.pendingCount)}
              sub={totals.pendingCount > 0 ? `${money(totals.pendingValue)} at stake` : 'none right now'}
              muted
            />
          </div>

          {/* Timeline */}
          <Section title="Revenue over time">
            {timeline.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'rgba(14,12,10,0.5)' }}>No confirmed bookings yet.</p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', overflowX: 'auto', paddingBottom: '4px' }}>
                {timeline.map((t) => (
                  <div key={t.date} title={`${t.date}: ${money(t.revenue)}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '28px' }}>
                    <div style={{ width: '18px', height: `${Math.max(4, (t.revenue / maxTimelineRevenue) * 90)}px`, background: '#4A6741', borderRadius: '3px 3px 0 0' }} />
                    <span style={{ fontSize: '9px', color: 'rgba(14,12,10,0.5)', marginTop: '4px', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                      {t.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Recent bookings */}
          <Section title="Recent bookings">
            {recentBookings.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'rgba(14,12,10,0.5)' }}>No bookings yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recentBookings.map((b) => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', fontSize: '13px', padding: '10px 12px', background: '#fff', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.06)' }}>
                    <span style={{ fontWeight: 600 }}>{b.organiserName}</span>
                    <span style={{ color: 'rgba(14,12,10,0.6)' }}>{b.eventTitle || 'No linked event'}</span>
                    <span style={{ color: 'rgba(14,12,10,0.6)' }}>{shortDate(b.fromDate)} – {shortDate(b.toDate)}</span>
                    <span style={{ fontWeight: 600 }}>{money(b.amount)}</span>
                    <span style={{ color: 'rgba(14,12,10,0.4)' }}>{timeAgo(b.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </main>
    </>
  )
}

function SummaryCard({ label, value, sub, muted }: { label: string; value: string; sub?: string; muted?: boolean }) {
  return (
    <div style={{ background: muted ? 'rgba(14,12,10,0.03)' : '#fff', border: '1px solid rgba(14,12,10,0.08)', borderRadius: '10px', padding: '16px' }}>
      <p style={{ fontSize: '12px', color: 'rgba(14,12,10,0.55)', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</p>
      <p style={{ fontSize: '22px', fontWeight: 700, color: '#0E0C0A' }}>{value}</p>
      {sub && <p style={{ fontSize: '12px', color: 'rgba(14,12,10,0.5)', marginTop: '4px' }}>{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.06)' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0E0C0A', marginBottom: '14px' }}>{title}</h2>
      {children}
    </div>
  )
}
