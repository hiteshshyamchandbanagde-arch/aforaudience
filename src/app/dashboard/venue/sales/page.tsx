'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import Link from 'next/link'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import SiteNav from '@/components/SiteNav'
import RangePicker from '@/components/RangePicker'
import BrandLoader from '@/components/BrandLoader'
import DashboardShell from '@/components/DashboardShell'
import { PageHead, Card, EmptyState, IconChart } from '@/components/dashboard/VenuePortalUI'
import Button from '@/components/ui/Button'
import { calendarDate, formatDate } from '@/lib/format-date'
import { useLocale, type Dictionary } from '@/lib/i18n/translate'
import { countText } from '@/lib/i18n/plural'
import { chartTooltipProps } from '@/lib/chart-tooltip'
import { StatLabel } from '@/components/dashboard/PageTitle'
import { formatINR } from '@/lib/money-display'
import { moneyAxis } from '@/lib/money-axis'

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

const money = formatINR


// bucketKeyFor() produces "YYYY-MM" (year/all ranges), a Monday-anchored
// "YYYY-MM-DD" (quarter), or a daily "YYYY-MM-DD" (week/month) - format
// each into a short axis label rather than showing the raw ISO key.
function formatBucketLabel(key: string, locale: string) {
  if (key.length === 7) {
    const [y, m] = key.split('-')
    return formatDate(calendarDate(Number(y), Number(m) - 1), 'monthYearShort', locale)
  }
  const d = new Date(key)
  return formatDate(d, 'short', locale)
}

type SalesText = Dictionary['venueDashboard']['sales']

function timeAgo(iso: string, v: SalesText) {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 5) return v.justNow
  if (secs < 60) return v.secondsAgo.replace('{n}', String(secs))
  const mins = Math.floor(secs / 60)
  if (mins < 60) return v.minutesAgo.replace('{n}', String(mins))
  const hrs = Math.floor(mins / 60)
  return v.hoursAgo.replace('{n}', String(hrs))
}

// Guards the "0 -> any value reads as +Infinity%" case - both a genuinely
// empty previous period and the unbounded 'all' range (which never has a
// previous period at all) land here as "no previous data", not a bogus %.
function delta(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return ((current - previous) / previous) * 100
}

export default function VenueOwnerSalesOverviewPage() {
  const { locale, t: tr } = useLocale()
  const v = tr.venueDashboard.sales
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
        if (res.status === 403) throw new Error(v.noAccess)
        throw new Error(v.loadFailed)
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
  }, [v])

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

  if (status === 'loading' || loading) return (<><SiteNav /><DashboardShell><BrandLoader label={tr.dashboardChrome.loading} /></DashboardShell></>)
  if (!session) return (<><SiteNav /><DashboardShell>{null}</DashboardShell></>)
  if (error && !data) return (<><SiteNav /><DashboardShell><div style={{ padding: 'var(--afa-space-32px)', color: 'var(--afa-error-bright)' }}>{error}</div></DashboardShell></>)
  if (!data) return (<><SiteNav /><DashboardShell><div style={{ padding: 'var(--afa-space-32px)' }}>{v.noData}</div></DashboardShell></>)

  const { totals, previousTotals, venues, organisers, timeline } = data
  const topVenues = venues.slice(0, TOP_VENUES_SHOWN)
  const hasMoreVenues = venues.length > TOP_VENUES_SHOWN
  // BUG-2609-070 - with no revenue anywhere the bar chart was venue names
  // over a meaningless ₹0-₹4 axis; show the empty state instead (the
  // venue table below stays).
  const noVenueRevenue = venues.every((row) => !row.revenue)

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-page)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: 'var(--afa-space-48px) var(--afa-space-6) var(--afa-space-80px)' }}>
          <div>
            <PageHead
              eyebrow={v.eyebrow}
              title={v.title}
              description={refreshedAt ? v.updated.replace('{ago}', timeAgo(refreshedAt.toISOString(), v)).replace('{n}', String(POLL_MS / 1000)) : undefined}
            >
              <RangePicker value={range} onChange={setRange} />
            </PageHead>
          </div>

          {error && (
            <div style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-error-bright)', marginBottom: 'var(--afa-space-4)' }}>{v.staleData.replace('{error}', error)}</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--afa-space-14px)', marginBottom: 'var(--afa-space-5)' }}>
            <StatCard id="total-revenue" label={v.totalRevenue} value={money(totals.grossRevenue)} delta={delta(totals.grossRevenue, previousTotals.grossRevenue)} sub={tr.common.byEventDate} vs={v.vsLastPeriod} />
            <StatCard id="confirmed-bookings" label={v.confirmedBookings} value={String(totals.confirmedBookingsCount)} delta={delta(totals.confirmedBookingsCount, previousTotals.confirmedBookingsCount)} vs={v.vsLastPeriod} />
            <StatCard id="avg-booking-value" label={v.avgBookingValue} value={money(Math.round(totals.avgBookingValue))} delta={delta(totals.avgBookingValue, previousTotals.avgBookingValue)} vs={v.vsLastPeriod} />
            <StatCard id="venues" label={v.venues} value={String(totals.venuesCount)} sub={v.venuesSub} />
          </div>

          <Section id="revenue-over-time" title={v.revenueOverTime}>
            {timeline.length < 3 ? (
              <EmptyState icon={<IconChart size={48} strokeWidth={1} />} caption={v.notEnoughTrend} />
            ) : (
              <div style={{ height: '260px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeline} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" style={{ stopColor: 'var(--afa-amber)' }} stopOpacity={0.35} />
                        <stop offset="100%" style={{ stopColor: 'var(--afa-amber)' }} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid style={{ stroke: 'var(--afa-tint-06)' }} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(key: string) => formatBucketLabel(key, locale)}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'var(--afa-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-micro)' }}
                    />
                    <YAxis
                      {...moneyAxis(Math.max(0, ...timeline.map((t) => t.revenue)))}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tick={{ fill: 'var(--afa-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-micro)' }}
                    />
                    <Tooltip
                      {...chartTooltipProps}
                      cursor={{ style: { stroke: 'var(--afa-amber-border)' }, strokeDasharray: '3 3' }}
                      labelFormatter={(label) => (typeof label === 'string' ? formatBucketLabel(label, locale) : String(label ?? ''))}
                      formatter={(value: any) => [money(Number(value)), v.revenue]}
                    />
                    <Area type="monotone" dataKey="revenue" style={{ stroke: 'var(--afa-amber)' }} strokeWidth={2} fill="url(#revFill)" dot={false} activeDot={{ r: 4, style: { fill: 'var(--afa-amber)' } }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          <Section id="by-venue" title={v.byVenue}>
            {venues.length === 0 ? (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-secondary)' }}>{v.noVenues}</p>
            ) : (
              <>
                {noVenueRevenue ? (
                  <div style={{ marginBottom: 'var(--afa-space-5)' }}>
                    <EmptyState icon={<IconChart size={48} strokeWidth={1} />} caption={v.noBookingsInRange} />
                  </div>
                ) : (
                <div style={{ height: `${topVenues.length * 44 + 20}px`, width: '100%', marginBottom: 'var(--afa-space-5)' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topVenues} layout="vertical" margin={{ left: 8, right: 24 }}>
                      <CartesianGrid style={{ stroke: 'var(--afa-tint-06)' }} horizontal={false} />
                      <XAxis type="number" {...moneyAxis(Math.max(0, ...topVenues.map((row) => row.revenue)))} tickLine={false} axisLine={false} tick={{ fill: 'var(--afa-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-micro)' }} />
                      <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} tick={{ fill: 'var(--afa-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-micro)' }} />
                      <Tooltip
                        {...chartTooltipProps}
                        cursor={{ style: { fill: 'var(--afa-tint-04)' } }}
                        formatter={(value: any) => [money(Number(value)), v.revenue]}
                      />
                      <Bar dataKey="revenue" radius={[0, 6, 6, 0]} barSize={22}>
                        {topVenues.map((row, i) => (
                          <Cell key={row.id} style={{ fill: i === 0 ? 'var(--afa-amber)' : 'var(--afa-amber-border)' }} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                )}

                {hasMoreVenues && !showAllVenues && (
                  <Button
                    variant="outline-neutral"
                    size="md"
                    fullWidth={false}
                    onClick={() => setShowAllVenues(true)}
                    data-afa-venues-toggle="all"
                    className="avp-hover-border"
                    style={{ marginBottom: showAllVenues ? 'var(--afa-space-4)' : 0 }}
                  >
                    {v.viewAll.replace('{n}', String(venues.length))}
                  </Button>
                )}

                {(showAllVenues || !hasMoreVenues) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-2)', marginTop: hasMoreVenues ? 'var(--afa-space-4)' : 0 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-micro)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--afa-text-muted)', padding: '0 var(--afa-space-3)' }}>
                      <span>{v.colVenue}</span>
                      <span>{v.colCity}</span>
                      <span>{v.colRevenue}</span>
                      <span>{v.colBookings}</span>
                    </div>
                    {venues.map((row) => (
                      <Link
                        key={row.id}
                        href={`/dashboard/venue/${row.id}/sales?range=${range}`}
                        className="avp-hover-border"
                        style={{
                          display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', alignItems: 'center',
                          fontSize: 'var(--afa-text-ui)', padding: 'var(--afa-space-3)', background: 'var(--afa-surface-inverse)', borderRadius: 'var(--afa-radius-md)',
                          border: '1px solid var(--afa-tint-08)', textDecoration: 'none', color: 'var(--afa-text-primary)',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{row.name}</span>
                        <span style={{ color: 'var(--afa-text-secondary)' }}>{row.city}</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{money(row.revenue)}</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{row.bookings}</span>
                      </Link>
                    ))}
                    {showAllVenues && (
                      // BUG-2609-070 - the same outline button as "View all", so the pair matches.
                      <Button
                        variant="outline-neutral"
                        size="md"
                        fullWidth={false}
                        onClick={() => setShowAllVenues(false)}
                        data-afa-venues-toggle="top"
                        className="avp-hover-border"
                        style={{ alignSelf: 'flex-start' }}
                      >
                        {v.showTop.replace('{n}', String(TOP_VENUES_SHOWN))}
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </Section>

          {/* Demoted relative to "By venue" - secondary context for a
              venue owner (who they're renting to), not a primary metric. */}
          <div data-afa-section="by-organiser" style={{ padding: 'var(--afa-space-1) var(--afa-space-1) var(--afa-space-40px)' }}>
            <p data-afa-section-title style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-micro)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--afa-text-muted)', margin: '0 0 var(--afa-space-10px)' }}>
              {v.byOrganiser}
            </p>
            {organisers.length === 0 ? (
              <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-secondary)' }}>{v.noBookingsInRangeDot}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderRadius: 'var(--afa-radius-md)', overflow: 'hidden', border: '1px solid var(--afa-tint-06)' }}>
                {organisers.map((o) => (
                  <div
                    key={o.organiserId}
                    style={{
                      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', alignItems: 'center',
                      fontSize: 'var(--afa-text-ui)', padding: '9px var(--afa-space-3)', background: 'var(--afa-tint-04)', color: 'var(--afa-text-secondary)', // token-ok(spacing-literal): 9px odd value, no exact token (GEN-2609-107)
                    }}
                  >
                    <span style={{ color: 'var(--afa-text-primary)' }}>{o.orgName}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{money(o.revenue)}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{countText(locale, o.bookings, v.bookingsOne, v.bookingsOther)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      </DashboardShell>
    </>
  )
}

function StatCard({ id, label, value, delta, sub, vs = '' }: { id: string; label: string; value: string; delta?: number | null; sub?: string; vs?: string }) {
  return (
    <Card data-afa-stat={id} style={{ padding: 'var(--afa-space-18px)' }}>
      <StatLabel style={{ margin: '0 0 var(--afa-space-2)' }}>{label}</StatLabel>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-heading)', color: 'var(--afa-text-primary)', margin: 0 }}>{value}</p>
      {delta != null && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-micro)', color: delta >= 0 ? 'var(--afa-sage-bright)' : 'var(--afa-error-bright)', marginTop: 'var(--afa-space-6px)', marginBottom: 0 }}>
          {delta >= 0 ? '▲' : '▼'} {vs.replace('{pct}', Math.abs(delta).toFixed(1))}
        </p>
      )}
      {sub && (
        <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-muted)', marginTop: 'var(--afa-space-6px)', marginBottom: 0 }}>{sub}</p>
      )}
    </Card>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card data-afa-section={id} style={{ padding: 'var(--afa-space-5)', marginBottom: 'var(--afa-space-5)' }}>
      <h2 data-afa-section-title style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--afa-text-title)', fontWeight: 500, color: 'var(--afa-text-primary)', margin: '0 0 var(--afa-space-4)' }}>{title}</h2>
      {children}
    </Card>
  )
}
