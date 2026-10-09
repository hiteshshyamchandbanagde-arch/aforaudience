'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, use, useCallback, useRef, ReactNode, Suspense } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import RangePicker from '@/components/RangePicker'
import BrandLoader from '@/components/BrandLoader'
import { PageTitle, StatLabel } from '@/components/dashboard/PageTitle'
import { formatINR } from '@/lib/money-display'
import { useLocale } from '@/lib/i18n/translate'
import { timeAgo } from '@/lib/sales-time-ago'

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

const money = formatINR

function EventSalesPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t: tr } = useLocale()
  const s = tr.organiserDashboard.sales
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
        if (res.status === 403) throw new Error(s.eventNoAccess)
        throw new Error(s.eventLoadFailed)
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
  }, [id, s])

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

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader label={tr.dashboardChrome.loading} /></>)
  if (!session) return <SiteNav />
  if (error && !data) return (<><SiteNav /><div style={{ padding: 'var(--afa-space-32px)', color: 'var(--afa-error-bright)' }}>{error}</div></>)
  if (!data) return (<><SiteNav /><div style={{ padding: 'var(--afa-space-32px)' }}>{s.noData}</div></>)

  const { event, tiers, totals, timeline, recentBookings } = data
  const maxTimelineSeats = Math.max(1, ...timeline.map((t) => t.seats))
  const pctSold = totals.totalCapacity > 0 ? Math.round((totals.totalSeatsSold / totals.totalCapacity) * 100) : 0

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--afa-space-48px) var(--afa-space-6)' }}>
          <div style={{ display: 'flex', gap: 'var(--afa-space-4)', flexWrap: 'wrap' }}>
            <BackLink href={`/dashboard/organiser/events/${id}`} label={s.backToEvent} />
            <Link href="/dashboard/organiser/sales" style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-fill-solid)', textDecoration: 'none', fontWeight: 600 }}>
              {s.allEvents}
            </Link>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'var(--afa-space-3)', marginBottom: 'var(--afa-space-4)', flexWrap: 'wrap', gap: 'var(--afa-space-2)' }}>
            <PageTitle>
              {s.eventTitle.replace('{title}', event.title)}
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

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--afa-space-14px)', marginBottom: 'var(--afa-space-28px)' }}>
            <SummaryCard label={s.grossRevenue} value={money(totals.grossRevenue)} sub={s.grossSub.replace('{tickets}', money(totals.subtotalRevenue)).replace('{fees}', money(totals.bookingFeeRevenue))} />
            <SummaryCard label={s.seatsSoldAllTime} value={`${totals.totalSeatsSold} / ${totals.totalCapacity}`} sub={s.pctOfCapacity.replace('{pct}', String(pctSold))} />
            <SummaryCard label={s.confirmedBookings} value={String(totals.confirmedBookingsCount)} sub={s.thisRange} />
            <SummaryCard
              label={s.reserved}
              value={String(totals.pendingSeats)}
              sub={totals.pendingCount > 0 ? s.atStake.replace('{amount}', money(totals.pendingValue)) : s.noneRightNow}
              muted
            />
          </div>

          {/* Tier breakdown */}
          <Section title={s.byTicketTier}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-10px)' }}>
              {tiers.map((t) => {
                const pct = t.totalSeats > 0 ? Math.min(100, Math.round((t.sold / t.totalSeats) * 100)) : 0
                return (
                  <div key={t.sectionName}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--afa-text-ui)', marginBottom: 'var(--afa-space-1)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--afa-text-primary)' }}>{t.sectionName} {t.price > 0 ? `· ${formatINR(t.price)}` : `· ${s.free}`}</span>
                      <span style={{ color: 'var(--afa-text-secondary)' }}>{t.sold} / {t.totalSeats}</span>
                    </div>
                    <div style={{ height: '8px', borderRadius: 'var(--afa-radius-xs)', background: 'var(--afa-tint-08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--afa-sage)', borderRadius: 'var(--afa-radius-xs)', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>

          {/* Timeline */}
          <Section title={s.salesOverTime}>
            {timeline.length === 0 ? (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-muted)' }}>{s.noSalesYet}</p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--afa-space-6px)', height: '120px', overflowX: 'auto', paddingBottom: 'var(--afa-space-1)' }}>
                {timeline.map((t) => (
                  <div key={t.date} title={s.timelineTip.replace('{date}', t.date).replace('{n}', String(t.seats)).replace('{amount}', money(t.revenue))} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '28px' }}>
                    <div style={{ width: '18px', height: `${Math.max(4, (t.seats / maxTimelineSeats) * 90)}px`, background: 'var(--afa-fill-solid)', borderRadius: 'var(--afa-radius-xs) var(--afa-radius-xs) var(--afa-radius-sharp) var(--afa-radius-sharp)' }} />
                    <span style={{ fontSize: 'var(--afa-text-caption)', color: 'var(--afa-text-muted)', marginTop: 'var(--afa-space-1)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                      {t.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Recent bookings */}
          <Section title={s.recentBookings}>
            {recentBookings.length === 0 ? (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-muted)' }}>{s.noBookings}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-2)' }}>
                {recentBookings.map((b) => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--afa-text-ui)', padding: 'var(--afa-space-10px) var(--afa-space-3)', background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-md)', border: '1px solid var(--afa-tint-06)' }}>
                    <span style={{ fontWeight: 600 }}>{b.name}</span>
                    <span style={{ color: 'var(--afa-text-secondary)' }}>
                      {Object.entries(b.seats).map(([s, q]) => `${q}× ${s}`).join(', ')}
                    </span>
                    <span style={{ fontWeight: 600 }}>{money(b.amount)}</span>
                    <span style={{ color: 'var(--afa-text-muted)' }}>{timeAgo(b.createdAt, s)}</span>
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
    <div style={{ background: muted ? 'var(--afa-tint-04)' : 'var(--afa-surface-raised)', border: '1px solid var(--afa-tint-08)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-4)' }}>
      <StatLabel style={{ marginBottom: 'var(--afa-space-6px)' }}>{label}</StatLabel>
      <p style={{ fontSize: 'var(--afa-text-subheading)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{value}</p>
      {sub && <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-muted)', marginTop: 'var(--afa-space-1)' }}>{sub}</p>}
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

export default function EventSalesPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<><SiteNav /><BrandLoader /></>}>
      <EventSalesPageInner {...props} />
    </Suspense>
  )
}
