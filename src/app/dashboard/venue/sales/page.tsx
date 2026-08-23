'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import RangePicker from '@/components/RangePicker'
import BrandLoader from '@/components/BrandLoader'
import { PageHead, Card } from '@/components/dashboard/VenuePortalUI'

interface VenueRow {
  id: string
  name: string
  city: string
  capacity: number
  revenue: number
  bookings: number
}

interface OrganiserRow {
  organiserId: string
  orgName: string
  revenue: number
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
    venuesCount: number
    confirmedBookingsCount: number
  }
  venues: VenueRow[]
  organisers: OrganiserRow[]
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

export default function VenueOwnerSalesOverviewPage() {
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
      const res = await fetch(`/api/venues/sales-overview?range=${r}`)
      if (!res.ok) {
        if (res.status === 403) throw new Error('You do not have access to this page')
        throw new Error('Could not load revenue overview')
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

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader /></>)
  if (!session) return <SiteNav />
  if (error && !data) return (<><SiteNav /><div style={{ padding: '32px', color: 'var(--afa-error)' }}>{error}</div></>)
  if (!data) return (<><SiteNav /><div style={{ padding: '32px' }}>No data</div></>)

  const { totals, venues, organisers, timeline } = data
  const maxTimelineRevenue = Math.max(1, ...timeline.map((t) => t.revenue))

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-page)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px 80px' }}>
          <BackLink href="/dashboard/venue" label="Back to Dashboard" />

          <div style={{ marginTop: '20px' }}>
            <PageHead
              eyebrow="Analytics"
              title="Revenue Overview"
              description={refreshedAt ? `Updated ${timeAgo(refreshedAt.toISOString())} · refreshes every 30s` : undefined}
            >
              <RangePicker value={range} onChange={setRange} />
            </PageHead>
          </div>

          {error && (
            <div style={{ fontSize: '13px', color: 'var(--afa-error)', marginBottom: '16px' }}>{error} (showing last good data)</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <SummaryCard label="Gross Revenue" value={money(totals.grossRevenue)} sub="no platform cut" />
            <SummaryCard label="Venues" value={String(totals.venuesCount)} />
            <SummaryCard label="Confirmed Bookings" value={String(totals.confirmedBookingsCount)} />
          </div>

          <Section title="Revenue over time">
            {timeline.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'var(--afa-text-muted)' }}>No confirmed bookings in this range.</p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', overflowX: 'auto', paddingBottom: '4px' }}>
                {timeline.map((t) => (
                  <div key={t.date} title={`${t.date}: ${money(t.revenue)}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '28px' }}>
                    <div style={{ width: '18px', height: `${Math.max(4, (t.revenue / maxTimelineRevenue) * 90)}px`, background: 'var(--afa-amber)', borderRadius: '3px 3px 0 0' }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--afa-text-muted)', marginTop: '4px', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                      {t.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="By venue">
            {venues.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'var(--afa-text-muted)' }}>No venues yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', fontFamily: 'var(--font-mono)', fontSize: '10.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--afa-text-muted)', padding: '0 12px' }}>
                  <span>Venue</span>
                  <span>City</span>
                  <span>Revenue</span>
                  <span>Bookings</span>
                </div>
                {venues.map((v) => (
                  <Link
                    key={v.id}
                    href={`/dashboard/venue/${v.id}/sales?range=${range}`}
                    className="avp-hover-border"
                    style={{
                      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', alignItems: 'center',
                      fontSize: '13px', padding: '12px', background: '#171717', borderRadius: '8px',
                      border: '1px solid rgba(245,245,240,0.08)', textDecoration: 'none', color: 'var(--afa-text-primary)',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{v.name}</span>
                    <span style={{ color: 'var(--afa-text-secondary)' }}>{v.city}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{money(v.revenue)}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{v.bookings}</span>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          <Section title="By organiser">
            {organisers.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'var(--afa-text-muted)' }}>No bookings in this range.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', fontFamily: 'var(--font-mono)', fontSize: '10.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--afa-text-muted)', padding: '0 12px' }}>
                  <span>Organiser</span>
                  <span>Revenue</span>
                  <span>Bookings</span>
                </div>
                {organisers.map((o) => (
                  <div
                    key={o.organiserId}
                    style={{
                      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', alignItems: 'center',
                      fontSize: '13px', padding: '12px', background: '#171717', borderRadius: '8px',
                      border: '1px solid rgba(245,245,240,0.08)', color: 'var(--afa-text-primary)',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{o.orgName}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{money(o.revenue)}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{o.bookings}</span>
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

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card style={{ padding: '18px' }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--afa-text-muted)', margin: '0 0 8px' }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: 'var(--afa-text-primary)', margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: '12px', color: 'var(--afa-text-muted)', marginTop: '6px', marginBottom: 0 }}>{sub}</p>}
    </Card>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card style={{ padding: '20px', marginBottom: '20px' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 500, color: 'var(--afa-text-primary)', margin: '0 0 16px' }}>{title}</h2>
      {children}
    </Card>
  )
}
