'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, use, useCallback, useRef, ReactNode, Suspense } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import RangePicker from '@/components/RangePicker'

interface Tier {
  sectionName: string
  price: number
  totalSeats: number
  sold: number
}

interface TimelinePoint {
  date: string
  seats: number
  revenue: number
}

interface RecentBooking {
  id: string
  name: string
  seats: Record<string, number>
  amount: number
  createdAt: string
}

interface SalesData {
  event: { id: string; title: string; totalSeats: number; availableSeats: number; isFree: boolean }
  tiers: Tier[]
  totals: {
    totalSeatsSold: number
    totalCapacity: number
    subtotalRevenue: number
    bookingFeeRevenue: number
    grossRevenue: number
    confirmedBookingsCount: number
    pendingSeats: number
    pendingValue: number
    pendingCount: number
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

function EventSalesPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [range, setRange] = useState(searchParams.get('range') || 'all')
  const [data, setData] = useState<SalesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchSales = useCallback(async (r: string) => {
    try {
      const res = await fetch(`/api/events/${id}/sales?range=${r}`)
      if (!res.ok) {
        if (res.status === 403) throw new Error('You do not have access to this event')
        throw new Error('Could not load sales data')
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
    setLoading(true)
    fetchSales(range)
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => fetchSales(range), POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [status, range, fetchSales])

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />
  if (error && !data) return (<><SiteNav /><div style={{ padding: '32px', color: 'var(--afa-error)' }}>{error}</div></>)
  if (!data) return (<><SiteNav /><div style={{ padding: '32px' }}>No data</div></>)

  const { event, tiers, totals, timeline, recentBookings } = data
  const maxTimelineSeats = Math.max(1, ...timeline.map((t) => t.seats))
  const pctSold = totals.totalCapacity > 0 ? Math.round((totals.totalSeatsSold / totals.totalCapacity) * 100) : 0

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-cream)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <Link href={`/dashboard/organiser/events/${id}`} style={{ fontSize: '14px', color: 'var(--afa-terracotta)', textDecoration: 'none', fontWeight: 600 }}>
              ← Back to event
            </Link>
            <Link href="/dashboard/organiser/sales" style={{ fontSize: '14px', color: 'var(--afa-terracotta)', textDecoration: 'none', fontWeight: 600 }}>
              All events →
            </Link>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '12px', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '30px', fontWeight: 700, color: 'var(--afa-ink)' }}>
              📊 {event.title} — Sales
            </h1>
            <span style={{ fontSize: '12px', color: 'rgba(14,12,10,0.5)' }}>
              {refreshedAt ? `Updated ${timeAgo(refreshedAt.toISOString())} · refreshes every 20s` : ''}
            </span>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <RangePicker value={range} onChange={setRange} />
          </div>

          {error && (
            <div style={{ fontSize: '13px', color: 'var(--afa-error)', marginBottom: '16px' }}>{error} (showing last good data)</div>
          )}

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '28px' }}>
            <SummaryCard label="Gross Revenue" value={money(totals.grossRevenue)} sub={`${money(totals.subtotalRevenue)} tickets + ${money(totals.bookingFeeRevenue)} fees — this range`} />
            <SummaryCard label="Seats Sold (all-time)" value={`${totals.totalSeatsSold} / ${totals.totalCapacity}`} sub={`${pctSold}% of capacity`} />
            <SummaryCard label="Confirmed Bookings" value={String(totals.confirmedBookingsCount)} sub="this range" />
            <SummaryCard
              label="Reserved (payment in progress)"
              value={String(totals.pendingSeats)}
              sub={totals.pendingCount > 0 ? `${money(totals.pendingValue)} at stake, may expire` : 'none right now'}
              muted
            />
          </div>

          {/* Tier breakdown */}
          <Section title="By ticket tier">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tiers.map((t) => {
                const pct = t.totalSeats > 0 ? Math.min(100, Math.round((t.sold / t.totalSeats) * 100)) : 0
                return (
                  <div key={t.sectionName}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--afa-ink)' }}>{t.sectionName} {t.price > 0 ? `· ₹${t.price}` : '· Free'}</span>
                      <span style={{ color: 'rgba(14,12,10,0.6)' }}>{t.sold} / {t.totalSeats}</span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(14,12,10,0.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--afa-sage)', borderRadius: '4px', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>

          {/* Timeline */}
          <Section title="Sales over time">
            {timeline.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'rgba(14,12,10,0.5)' }}>No confirmed sales yet.</p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', overflowX: 'auto', paddingBottom: '4px' }}>
                {timeline.map((t) => (
                  <div key={t.date} title={`${t.date}: ${t.seats} seats, ${money(t.revenue)}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '28px' }}>
                    <div style={{ width: '18px', height: `${Math.max(4, (t.seats / maxTimelineSeats) * 90)}px`, background: 'var(--afa-terracotta)', borderRadius: '3px 3px 0 0' }} />
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
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '10px 12px', background: 'var(--afa-white)', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.06)' }}>
                    <span style={{ fontWeight: 600 }}>{b.name}</span>
                    <span style={{ color: 'rgba(14,12,10,0.6)' }}>
                      {Object.entries(b.seats).map(([s, q]) => `${q}× ${s}`).join(', ')}
                    </span>
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
    <div style={{ background: muted ? 'rgba(14,12,10,0.03)' : 'var(--afa-white)', border: '1px solid rgba(14,12,10,0.08)', borderRadius: '10px', padding: '16px' }}>
      <p style={{ fontSize: '12px', color: 'rgba(14,12,10,0.55)', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</p>
      <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--afa-ink)' }}>{value}</p>
      {sub && <p style={{ fontSize: '12px', color: 'rgba(14,12,10,0.5)', marginTop: '4px' }}>{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '20px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.06)' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '14px' }}>{title}</h2>
      {children}
    </div>
  )
}

export default function EventSalesPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>}>
      <EventSalesPageInner {...props} />
    </Suspense>
  )
}
