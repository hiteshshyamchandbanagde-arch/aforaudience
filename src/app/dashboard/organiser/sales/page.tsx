'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import RangePicker from '@/components/RangePicker'
import BrandLoader from '@/components/BrandLoader'
import DashboardShell from '@/components/DashboardShell'

interface EventRow {
  id: string
  title: string
  status: string
  totalSeats: number
  revenue: number
  ticketsSold: number
  bookings: number
}

interface TimelinePoint {
  date: string
  revenue: number
}

interface OverviewData {
  range: string
  totals: {
    grossRevenue: number
    ticketsSold: number
    eventsCount: number
    confirmedBookingsCount: number
  }
  events: EventRow[]
  timeline: TimelinePoint[]
  generatedAt: string
}

const POLL_MS = 30000

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

export default function OrganiserSalesOverviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [range, setRange] = useState('all')
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchOverview = useCallback(async (r: string) => {
    try {
      const res = await fetch(`/api/organisers/sales-overview?range=${r}`)
      if (!res.ok) {
        if (res.status === 403) throw new Error('You do not have access to this page')
        throw new Error('Could not load sales overview')
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
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    setLoading(true)
    fetchOverview(range)
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => fetchOverview(range), POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [status, range, fetchOverview])

  if (status === 'loading' || loading) return (<><SiteNav /><DashboardShell><BrandLoader /></DashboardShell></>)
  if (!session) return (<><SiteNav /><DashboardShell>{null}</DashboardShell></>)
  if (error && !data) return (<><SiteNav /><DashboardShell><div style={{ padding: '32px', color: 'var(--afa-error-bright)' }}>{error}</div></DashboardShell></>)
  if (!data) return (<><SiteNav /><DashboardShell><div style={{ padding: '32px' }}>No data</div></DashboardShell></>)

  const { totals, events, timeline } = data
  const maxTimelineRevenue = Math.max(1, ...timeline.map((t) => t.revenue))

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-page-title)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>
              Sales Overview
            </h1>
            <span style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-muted)' }}>
              {refreshedAt ? `Updated ${timeAgo(refreshedAt.toISOString())} · refreshes every 30s` : ''}
            </span>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <RangePicker value={range} onChange={setRange} />
          </div>

          {error && (
            <div style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-error-bright)', marginBottom: '16px' }}>{error} (showing last good data)</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '28px' }}>
            <SummaryCard label="Gross Revenue" value={money(totals.grossRevenue)} />
            <SummaryCard label="Tickets Sold" value={String(totals.ticketsSold)} />
            <SummaryCard label="Events" value={String(totals.eventsCount)} />
            <SummaryCard label="Confirmed Bookings" value={String(totals.confirmedBookingsCount)} />
          </div>

          <Section title="Revenue over time">
            {timeline.length === 0 ? (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-muted)' }}>No confirmed sales in this range.</p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', overflowX: 'auto', paddingBottom: '4px' }}>
                {timeline.map((t) => (
                  <div key={t.date} title={`${t.date}: ${money(t.revenue)}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '28px' }}>
                    <div style={{ width: '18px', height: `${Math.max(4, (t.revenue / maxTimelineRevenue) * 90)}px`, background: 'var(--afa-fill-solid)', borderRadius: 'var(--afa-radius-xs) var(--afa-radius-xs) var(--afa-radius-sharp) var(--afa-radius-sharp)' }} />
                    <span style={{ fontSize: 'var(--afa-text-caption)', color: 'var(--afa-text-muted)', marginTop: '4px', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                      {t.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="By event">
            {events.length === 0 ? (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-muted)' }}>No events yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', fontSize: 'var(--afa-text-micro)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--afa-text-muted)', padding: '0 12px' }}>
                  <span>Event</span>
                  <span>Revenue</span>
                  <span>Tickets</span>
                  <span>Bookings</span>
                </div>
                {events.map((e) => (
                  <Link
                    key={e.id}
                    href={`/dashboard/organiser/events/${e.id}/sales?range=${range}`}
                    style={{
                      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', alignItems: 'center',
                      fontSize: 'var(--afa-text-ui)', padding: '12px', background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-md)',
                      border: '1px solid var(--afa-tint-06)', textDecoration: 'none', color: 'var(--afa-text-primary)',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{e.title}</span>
                    <span>{money(e.revenue)}</span>
                    <span>{e.ticketsSold} / {e.totalSeats}</span>
                    <span>{e.bookings}</span>
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </div>
      </main>
      </DashboardShell>
    </>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--afa-surface-raised)', border: '1px solid var(--afa-tint-08)', borderRadius: 'var(--afa-radius-lg)', padding: '16px' }}>
      <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-secondary)', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</p>
      <p style={{ fontSize: 'var(--afa-text-subheading)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: '20px', marginBottom: '20px', border: '1px solid var(--afa-tint-06)' }}>
      <h2 style={{ fontSize: 'var(--afa-text-title)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '14px' }}>{title}</h2>
      {children}
    </div>
  )
}
