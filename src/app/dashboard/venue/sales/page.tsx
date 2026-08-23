'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import Link from 'next/link'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import RangePicker from '@/components/RangePicker'
import BrandLoader from '@/components/BrandLoader'
import { PageHead, Card, EmptyState, IconChart } from '@/components/dashboard/VenuePortalUI'

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

interface Totals {
  grossRevenue: number
  venuesCount: number
  confirmedBookingsCount: number
  avgBookingValue: number
}

interface PreviousTotals {
  grossRevenue: number
  confirmedBookingsCount: number
  avgBookingValue: number
}

interface OverviewData {
  range: string
  totals: Totals
  previousTotals: PreviousTotals
  venues: VenueRow[]
  organisers: OrganiserRow[]
  timeline: TimelinePoint[]
  generatedAt: string
}

const POLL_MS = 30000
const TOP_VENUES_SHOWN = 5

const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

// Compact axis/bar-label form (₹73.4L, not ₹73,40,000) - full precision in
// the stat cards, compact here since chart labels have little room.
function compactMoney(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`
  return `₹${n}`
}

// bucketKeyFor() produces "YYYY-MM" (year/all ranges), a Monday-anchored
// "YYYY-MM-DD" (quarter), or a daily "YYYY-MM-DD" (week/month) - format
// each into a short axis label rather than showing the raw ISO key.
function formatBucketLabel(key: string) {
  if (key.length === 7) {
    const [y, m] = key.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
  }
  const d = new Date(key)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function timeAgo(iso: string) {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}

// Guards the "0 -> any value reads as +Infinity%" case - both a genuinely
// empty previous period and the unbounded 'all' range (which never has a
// previous period at all) land here as "no previous data", not a bogus %.
function delta(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return ((current - previous) / previous) * 100
}

export default function VenueOwnerSalesOverviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [range, setRange] = useState('all')
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)
  const [showAllVenues, setShowAllVenues] = useState(false)
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

  useEffect(() => { setShowAllVenues(false) }, [range])

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader /></>)
  if (!session) return <SiteNav />
  if (error && !data) return (<><SiteNav /><div style={{ padding: '32px', color: 'var(--afa-error)' }}>{error}</div></>)
  if (!data) return (<><SiteNav /><div style={{ padding: '32px' }}>No data</div></>)

  const { totals, previousTotals, venues, organisers, timeline } = data
  const topVenues = venues.slice(0, TOP_VENUES_SHOWN)
  const hasMoreVenues = venues.length > TOP_VENUES_SHOWN

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
            <StatCard label="Total Revenue" value={money(totals.grossRevenue)} delta={delta(totals.grossRevenue, previousTotals.grossRevenue)} />
            <StatCard label="Confirmed Bookings" value={String(totals.confirmedBookingsCount)} delta={delta(totals.confirmedBookingsCount, previousTotals.confirmedBookingsCount)} />
            <StatCard label="Avg. Booking Value" value={money(Math.round(totals.avgBookingValue))} delta={delta(totals.avgBookingValue, previousTotals.avgBookingValue)} />
            <StatCard label="Venues" value={String(totals.venuesCount)} sub="no platform cut on rentals" />
          </div>

          <Section title="Revenue over time">
            {timeline.length < 3 ? (
              <EmptyState icon={<IconChart size={48} strokeWidth={1} />} caption="Not enough bookings yet to show a trend" />
            ) : (
              <div style={{ height: '260px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeline} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c9973a" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#c9973a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(245,245,240,0.06)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatBucketLabel}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'rgba(245,245,240,0.4)', fontFamily: 'var(--font-mono)', fontSize: 11 }}
                    />
                    <YAxis
                      tickFormatter={compactMoney}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tick={{ fill: 'rgba(245,245,240,0.4)', fontFamily: 'var(--font-mono)', fontSize: 11 }}
                    />
                    <Tooltip
                      cursor={{ stroke: 'rgba(201,151,58,0.4)', strokeDasharray: '3 3' }}
                      contentStyle={{ background: '#0a0a0a', border: '1px solid rgba(245,245,240,0.12)', borderRadius: 10, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                      labelStyle={{ color: 'rgba(245,245,240,0.5)' }}
                      labelFormatter={(label) => (typeof label === 'string' ? formatBucketLabel(label) : String(label ?? ''))}
                      itemStyle={{ color: '#c9973a' }}
                      formatter={(v: any) => [money(Number(v)), 'Revenue']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#c9973a" strokeWidth={2} fill="url(#revFill)" dot={false} activeDot={{ r: 4, fill: '#c9973a' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          <Section title="By venue">
            {venues.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'var(--afa-text-muted)' }}>No venues yet.</p>
            ) : (
              <>
                <div style={{ height: `${topVenues.length * 44 + 20}px`, width: '100%', marginBottom: '20px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topVenues} layout="vertical" margin={{ left: 8, right: 24 }}>
                      <CartesianGrid stroke="rgba(245,245,240,0.06)" horizontal={false} />
                      <XAxis type="number" tickFormatter={compactMoney} tickLine={false} axisLine={false} tick={{ fill: 'rgba(245,245,240,0.4)', fontFamily: 'var(--font-mono)', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} tick={{ fill: 'rgba(245,245,240,0.65)', fontFamily: 'var(--font-mono)', fontSize: 11 }} />
                      <Tooltip
                        cursor={{ fill: 'rgba(245,245,240,0.03)' }}
                        contentStyle={{ background: '#0a0a0a', border: '1px solid rgba(245,245,240,0.12)', borderRadius: 10, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                        formatter={(v: any) => [money(Number(v)), 'Revenue']}
                      />
                      <Bar dataKey="revenue" radius={[0, 6, 6, 0]} barSize={22}>
                        {topVenues.map((v, i) => (
                          <Cell key={v.id} fill={i === 0 ? '#c9973a' : 'rgba(201,151,58,0.45)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {hasMoreVenues && !showAllVenues && (
                  <button
                    onClick={() => setShowAllVenues(true)}
                    className="avp-hover-border"
                    style={{ background: 'transparent', border: '1px solid rgba(245,245,240,0.08)', borderRadius: '8px', padding: '9px 14px', fontSize: '12.5px', color: 'var(--afa-text-secondary)', cursor: 'pointer', marginBottom: showAllVenues ? '16px' : 0 }}
                  >
                    View all {venues.length} venues
                  </button>
                )}

                {(showAllVenues || !hasMoreVenues) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: hasMoreVenues ? '16px' : 0 }}>
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
                    {showAllVenues && (
                      <button
                        onClick={() => setShowAllVenues(false)}
                        style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', padding: '4px 12px', fontSize: '12px', color: 'var(--afa-text-muted)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '3px' }}
                      >
                        Show top {TOP_VENUES_SHOWN} only
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </Section>

          {/* Demoted relative to "By venue" - secondary context for a
              venue owner (who they're renting to), not a primary metric. */}
          <div style={{ padding: '4px 4px 40px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--afa-text-muted)', margin: '0 0 10px' }}>
              By organiser
            </p>
            {organisers.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--afa-text-muted)' }}>No bookings in this range.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(245,245,240,0.06)' }}>
                {organisers.map((o) => (
                  <div
                    key={o.organiserId}
                    style={{
                      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', alignItems: 'center',
                      fontSize: '12.5px', padding: '9px 12px', background: 'rgba(245,245,240,0.02)', color: 'var(--afa-text-secondary)',
                    }}
                  >
                    <span style={{ color: 'var(--afa-text-primary)' }}>{o.orgName}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{money(o.revenue)}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{o.bookings} bookings</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}

function StatCard({ label, value, delta, sub }: { label: string; value: string; delta?: number | null; sub?: string }) {
  return (
    <Card style={{ padding: '18px' }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--afa-text-muted)', margin: '0 0 8px' }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: 'var(--afa-text-primary)', margin: 0 }}>{value}</p>
      {delta != null ? (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: delta >= 0 ? 'var(--afa-sage)' : 'var(--afa-error)', marginTop: '6px', marginBottom: 0 }}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% vs last period
        </p>
      ) : sub ? (
        <p style={{ fontSize: '12px', color: 'var(--afa-text-muted)', marginTop: '6px', marginBottom: 0 }}>{sub}</p>
      ) : null}
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
