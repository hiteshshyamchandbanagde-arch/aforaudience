'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import DashboardShell from '@/components/DashboardShell'
import BackLink from '@/components/BackLink'
import RangePicker from '@/components/RangePicker'
import BrandLoader from '@/components/BrandLoader'
import { timelineLabels } from '@/lib/timeline-label'
import { PageTitle, StatLabel } from '@/components/dashboard/PageTitle'
import { formatINR } from '@/lib/money-display'

interface OrganiserRow {
  organiserId: string
  orgName: string
  platformFee: number
  ticketSubtotal: number
  bookings: number
}

interface EventRow {
  eventId: string
  title: string
  platformFee: number
  bookings: number
}

interface TimelinePoint {
  date: string
  revenue: number
}

interface OverviewData {
  range: string
  totals: {
    platformFeeTotal: number
    ticketSubtotalTotal: number
    confirmedBookingsCount: number
    freeBookingsCount: number
  }
  currentFeeSettingRupees: number
  organisers: OrganiserRow[]
  events: EventRow[]
  timeline: TimelinePoint[]
  generatedAt: string
}

const POLL_MS = 30000

// Header and rows of the two "Top ..." tables: same horizontal padding and
// border width, so the columns line up.
const TABLE_HEAD_STYLE: React.CSSProperties = {
  fontSize: 'var(--afa-text-micro)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--afa-text-secondary)',
  padding: '0 var(--afa-space-3)', border: '1px solid transparent',
}
const TABLE_ROW_STYLE: React.CSSProperties = {
  fontSize: 'var(--afa-text-ui)', padding: 'var(--afa-space-3)', background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-md)',
  border: '1px solid var(--afa-tint-06)',
}

const money = formatINR

function timeAgo(iso: string) {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}

export default function AdminRevenueOverviewPage() {
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
      const res = await fetch(`/api/admin/revenue-overview?range=${r}`)
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
  if (error && !data) return (<><SiteNav /><div style={{ padding: 'var(--afa-space-32px)', color: 'var(--afa-error-bright)' }}>{error}</div></>)
  if (!data) return (<><SiteNav /><div style={{ padding: 'var(--afa-space-32px)' }}>No data</div></>)

  const { totals, organisers, events, timeline, currentFeeSettingRupees } = data
  const maxTimelineRevenue = Math.max(1, ...timeline.map((t) => t.revenue))
  const timelineLabelList = timelineLabels(timeline.map((t) => t.date))

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: 'var(--afa-space-48px) var(--afa-space-6)' }}>
          {/* BUG-2610-016 - header and rows share one column template (with a
              gap), and numbers are right-aligned under their headers, so at
              390 "Platform fee" and "Bookings" no longer run together and
              the headers line up with the values. Ticket volume shows from
              lg up only. */}
          <style>{`
            .afa-rev-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr); column-gap: var(--afa-space-3); align-items: center; }
            .afa-rev-num { text-align: right; }
            .afa-rev-wide { display: none; }
            @media (min-width: 1024px) {
              .afa-rev-grid-4 { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr); }
              .afa-rev-wide { display: block; }
            }
          `}</style>
          {/* lg:hidden - now redundant on desktop once DashboardShell's sidebar is there; still the only way back on mobile */}
          <div className="lg:hidden">
            <BackLink href="/dashboard/admin/feedback" label="Back to Dashboard" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'var(--afa-space-3)', marginBottom: 'var(--afa-space-5)', flexWrap: 'wrap', gap: 'var(--afa-space-3)' }}>
            <PageTitle>
              Platform Revenue
            </PageTitle>
            <span style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-secondary)' }}>
              {refreshedAt ? `Updated ${timeAgo(refreshedAt.toISOString())} · refreshes every 30s` : ''}
            </span>
          </div>

          <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-secondary)', marginBottom: 'var(--afa-space-5)', maxWidth: '640px' }}>
            Per the "never tax the scene" policy, the platform's only revenue is the audience-side
            booking fee, not organiser gross revenue. Venue rentals and performer fees pass through
            untaxed and don't appear here.
          </p>

          <div style={{ marginBottom: 'var(--afa-space-6)' }}>
            <RangePicker value={range} onChange={setRange} />
          </div>

          {error && (
            <div style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-error-bright)', marginBottom: 'var(--afa-space-4)' }}>{error} (showing last good data)</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--afa-space-14px)', marginBottom: 'var(--afa-space-28px)' }}>
            <SummaryCard label="Platform Revenue" value={money(totals.platformFeeTotal)} sub="booking fee, ours" />
            <SummaryCard label="Ticket Volume" value={money(totals.ticketSubtotalTotal)} sub="goes to organisers" />
            <SummaryCard label="Confirmed Bookings" value={String(totals.confirmedBookingsCount)} />
            <SummaryCard label="Free Bookings" value={String(totals.freeBookingsCount)} sub="no fee, by design" />
          </div>

          <Section title="Platform revenue over time">
            {timeline.length === 0 ? (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-secondary)' }}>No confirmed bookings in this range.</p>
            ) : (
              // BUG-2610-016 - "Sep" / "Oct" read horizontally under each bar
              // (the year only when the range spans years) and the ₹ value on
              // top of it; it used to be a rotated "09" / "10" and no value.
              <div data-afa-revenue-chart style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--afa-space-2)', overflowX: 'auto', paddingBottom: 'var(--afa-space-1)' }}>
                {timeline.map((t, i) => (
                  <div key={t.date} data-afa-revenue-bar title={`${timelineLabelList[i]}: ${money(t.revenue)}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '52px', flexShrink: 0 }}>
                    <span data-afa-bar-value style={{ fontSize: 'var(--afa-text-caption)', color: 'var(--afa-text-primary)', fontWeight: 600, marginBottom: 'var(--afa-space-1)', whiteSpace: 'nowrap' }}>
                      {money(t.revenue)}
                    </span>
                    <div style={{ width: '24px', height: `${Math.max(4, (t.revenue / maxTimelineRevenue) * 90)}px`, background: 'var(--afa-amber)', borderRadius: 'var(--afa-radius-xs) var(--afa-radius-xs) var(--afa-radius-sharp) var(--afa-radius-sharp)' }} />
                    <span data-afa-bar-label style={{ fontSize: 'var(--afa-text-caption)', color: 'var(--afa-text-secondary)', marginTop: 'var(--afa-space-1)', whiteSpace: 'nowrap' }}>
                      {timelineLabelList[i]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Top organisers by platform fee generated">
            {organisers.length === 0 ? (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-secondary)' }}>No bookings in this range.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-2)' }}>
                <div className="afa-rev-grid afa-rev-grid-4" style={TABLE_HEAD_STYLE}>
                  <span>Organiser</span>
                  <span className="afa-rev-num">Platform fee</span>
                  <span className="afa-rev-num afa-rev-wide">Ticket volume</span>
                  {/* BUG-2610-015 - data-afa-avoid: the chat button never rests on the last column. */}
                  <span className="afa-rev-num" data-afa-avoid>Bookings</span>
                </div>
                {organisers.map((o) => (
                  <div key={o.organiserId} className="afa-rev-grid afa-rev-grid-4" style={TABLE_ROW_STYLE}>
                    <span style={{ fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{o.orgName}</span>
                    <span className="afa-rev-num">{money(o.platformFee)}</span>
                    <span className="afa-rev-num afa-rev-wide">{money(o.ticketSubtotal)}</span>
                    <span className="afa-rev-num" data-afa-avoid>{o.bookings}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Top events by platform fee generated">
            {events.length === 0 ? (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-secondary)' }}>No bookings in this range.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-2)' }}>
                <div className="afa-rev-grid" style={TABLE_HEAD_STYLE}>
                  <span>Event</span>
                  <span className="afa-rev-num">Platform fee</span>
                  <span className="afa-rev-num" data-afa-avoid>Bookings</span>
                </div>
                {events.map((e) => (
                  <div key={e.eventId} className="afa-rev-grid" style={TABLE_ROW_STYLE}>
                    <span style={{ fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{e.title}</span>
                    <span className="afa-rev-num">{money(e.platformFee)}</span>
                    <span className="afa-rev-num" data-afa-avoid>{e.bookings}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--afa-space-3)', background: 'var(--afa-surface-raised)', border: '1px solid var(--afa-tint-08)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-14px) var(--afa-space-18px)' }}>
            <div>
              <p style={{ fontSize: 'var(--afa-text-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--afa-text-secondary)', marginBottom: 'var(--afa-space-1)' }}>
                Current booking fee
              </p>
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)' }}>{money(currentFeeSettingRupees)} per confirmed booking</p>
            </div>
            <Link href="/dashboard/admin/settings" style={{ fontSize: 'var(--afa-text-micro)', color: 'var(--afa-text-secondary)', whiteSpace: 'nowrap' }}>
              Edit in Settings →
            </Link>
          </div>
        </div>
      </main>
      </DashboardShell>
    </>
  )
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--afa-surface-page)', border: '1px solid var(--afa-tint-08)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-4)' }}>
      <StatLabel style={{ marginBottom: 'var(--afa-space-6px)' }}>{label}</StatLabel>
      <p style={{ fontSize: 'var(--afa-text-subheading)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{value}</p>
      {sub && <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-secondary)', marginTop: 'var(--afa-space-1)' }}>{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--afa-surface-page)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-5)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-06)' }}>
      <h2 style={{ fontSize: 'var(--afa-text-title)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-14px)' }}>{title}</h2>
      {children}
    </div>
  )
}
