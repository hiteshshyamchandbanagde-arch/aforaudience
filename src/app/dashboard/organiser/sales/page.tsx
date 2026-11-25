'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import RangePicker from '@/components/RangePicker'
import BrandLoader from '@/components/BrandLoader'
import DashboardShell from '@/components/DashboardShell'
import { PageTitle, StatLabel } from '@/components/dashboard/PageTitle'
import { formatINR } from '@/lib/money-display'
import { useLocale } from '@/lib/i18n/translate'
import { timeAgo } from '@/lib/sales-time-ago'

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

const money = formatINR

export default function OrganiserSalesOverviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t: tr } = useLocale()
  const s = tr.organiserDashboard.sales
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
        if (res.status === 403) throw new Error(s.pageNoAccess)
        throw new Error(s.overviewLoadFailed)
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
  }, [s])

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

  if (status === 'loading' || loading) return (<><SiteNav /><DashboardShell><BrandLoader label={tr.dashboardChrome.loading} /></DashboardShell></>)
  if (!session) return (<><SiteNav /><DashboardShell>{null}</DashboardShell></>)
  if (error && !data) return (<><SiteNav /><DashboardShell><div style={{ padding: 'var(--afa-space-32px)', color: 'var(--afa-error-bright)' }}>{error}</div></DashboardShell></>)
  if (!data) return (<><SiteNav /><DashboardShell><div style={{ padding: 'var(--afa-space-32px)' }}>{s.noData}</div></DashboardShell></>)

  const { totals, events, timeline } = data
  const maxTimelineRevenue = Math.max(1, ...timeline.map((t) => t.revenue))

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: 'var(--afa-space-48px) var(--afa-space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--afa-space-5)', flexWrap: 'wrap', gap: 'var(--afa-space-3)' }}>
            <PageTitle>
              {s.title}
            </PageTitle>
            <span style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-muted)' }}>
              {refreshedAt ? s.updated.replace('{ago}', timeAgo(refreshedAt.toISOString(), s)).replace('{n}', String(POLL_MS / 1000)) : ''}
            </span>
          </div>

          <div style={{ marginBottom: 'var(--afa-space-6)' }}>
            <RangePicker value={range} onChange={setRange} />
          </div>

          {error && (
            <div style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-error-bright)', marginBottom: 'var(--afa-space-4)' }}>{s.staleData.replace('{error}', error)}</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--afa-space-14px)', marginBottom: 'var(--afa-space-28px)' }}>
            <SummaryCard label={s.grossRevenue} value={money(totals.grossRevenue)} />
            <SummaryCard label={s.ticketsSold} value={String(totals.ticketsSold)} />
            <SummaryCard label={s.events} value={String(totals.eventsCount)} />
            <SummaryCard label={s.confirmedBookings} value={String(totals.confirmedBookingsCount)} />
          </div>

          <Section title={s.revenueOverTime}>
            {timeline.length === 0 ? (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-muted)' }}>{s.noSalesInRange}</p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--afa-space-6px)', height: '120px', overflowX: 'auto', paddingBottom: 'var(--afa-space-1)' }}>
                {timeline.map((t) => (
                  <div key={t.date} title={`${t.date}: ${money(t.revenue)}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '28px' }}>
                    <div style={{ width: '18px', height: `${Math.max(4, (t.revenue / maxTimelineRevenue) * 90)}px`, background: 'var(--afa-fill-solid)', borderRadius: 'var(--afa-radius-xs) var(--afa-radius-xs) var(--afa-radius-sharp) var(--afa-radius-sharp)' }} />
                    <span style={{ fontSize: 'var(--afa-text-caption)', color: 'var(--afa-text-muted)', marginTop: 'var(--afa-space-1)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                      {t.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={s.byEvent}>
            {events.length === 0 ? (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-muted)' }}>{s.noEvents}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-2)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', fontSize: 'var(--afa-text-micro)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--afa-text-muted)', padding: '0 var(--afa-space-3)' }}>
                  <span>{s.colEvent}</span>
                  <span>{s.colRevenue}</span>
                  <span>{s.colTickets}</span>
                  <span>{s.colBookings}</span>
                </div>
                {events.map((e) => (
                  <Link
                    key={e.id}
                    href={`/dashboard/organiser/events/${e.id}/sales?range=${range}`}
                    style={{
                      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', alignItems: 'center',
                      fontSize: 'var(--afa-text-ui)', padding: 'var(--afa-space-3)', background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-md)',
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
    <div style={{ background: 'var(--afa-surface-raised)', border: '1px solid var(--afa-tint-08)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-4)' }}>
      <StatLabel style={{ marginBottom: 'var(--afa-space-6px)' }}>{label}</StatLabel>
      <p style={{ fontSize: 'var(--afa-text-subheading)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-5)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-06)' }}>
      <h2 style={{ fontSize: 'var(--afa-text-title)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-14px)' }}>{title}</h2>
      {children}
    </div>
  )
}
