'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import RangePicker from '@/components/RangePicker'

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

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />
  if (error && !data) return (<><SiteNav /><div style={{ padding: '32px', color: '#B3261E' }}>{error}</div></>)
  if (!data) return (<><SiteNav /><div style={{ padding: '32px' }}>No data</div></>)

  const { totals, organisers, events, timeline, currentFeeSettingRupees } = data
  const maxTimelineRevenue = Math.max(1, ...timeline.map((t) => t.revenue))

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 24px' }}>
          <Link href="/dashboard/admin" style={{ fontSize: '14px', color: '#C8441A', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to dashboard
          </Link>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '12px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '30px', fontWeight: 700, color: '#0E0C0A' }}>
              💰 Platform Revenue
            </h1>
            <span style={{ fontSize: '12px', color: 'rgba(14,12,10,0.5)' }}>
              {refreshedAt ? `Updated ${timeAgo(refreshedAt.toISOString())} · refreshes every 30s` : ''}
            </span>
          </div>

          <p style={{ fontSize: '13px', color: 'rgba(14,12,10,0.6)', marginBottom: '20px', maxWidth: '640px' }}>
            Per the "never tax the scene" policy, the platform's only revenue is the audience-side
            booking fee — currently set to <strong>{money(currentFeeSettingRupees)}/ticket</strong> (change
            at <Link href="/dashboard/admin/settings" style={{ color: '#C8441A' }}>Settings</Link>). Venue
            rentals and performer fees pass through untaxed and don't appear here.
          </p>

          <div style={{ marginBottom: '24px' }}>
            <RangePicker value={range} onChange={setRange} />
          </div>

          {error && (
            <div style={{ fontSize: '13px', color: '#B3261E', marginBottom: '16px' }}>{error} (showing last good data)</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '28px' }}>
            <SummaryCard label="Platform Revenue" value={money(totals.platformFeeTotal)} sub="booking fee, ours" />
            <SummaryCard label="Ticket Volume" value={money(totals.ticketSubtotalTotal)} sub="goes to organisers" />
            <SummaryCard label="Confirmed Bookings" value={String(totals.confirmedBookingsCount)} />
            <SummaryCard label="Free Bookings" value={String(totals.freeBookingsCount)} sub="no fee, by design" />
          </div>

          <Section title="Platform revenue over time">
            {timeline.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'rgba(14,12,10,0.5)' }}>No confirmed bookings in this range.</p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', overflowX: 'auto', paddingBottom: '4px' }}>
                {timeline.map((t) => (
                  <div key={t.date} title={`${t.date}: ${money(t.revenue)}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '28px' }}>
                    <div style={{ width: '18px', height: `${Math.max(4, (t.revenue / maxTimelineRevenue) * 90)}px`, background: '#C8441A', borderRadius: '3px 3px 0 0' }} />
                    <span style={{ fontSize: '9px', color: 'rgba(14,12,10,0.5)', marginTop: '4px', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                      {t.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Top organisers by platform fee generated">
            {organisers.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'rgba(14,12,10,0.5)' }}>No bookings in this range.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', color: 'rgba(14,12,10,0.5)', padding: '0 12px' }}>
                  <span>Organiser</span>
                  <span>Platform Fee</span>
                  <span>Ticket Volume</span>
                  <span>Bookings</span>
                </div>
                {organisers.map((o) => (
                  <div
                    key={o.organiserId}
                    style={{
                      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', alignItems: 'center',
                      fontSize: '13px', padding: '12px', background: '#fff', borderRadius: '8px',
                      border: '1px solid rgba(14,12,10,0.06)',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{o.orgName}</span>
                    <span>{money(o.platformFee)}</span>
                    <span>{money(o.ticketSubtotal)}</span>
                    <span>{o.bookings}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Top events by platform fee generated">
            {events.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'rgba(14,12,10,0.5)' }}>No bookings in this range.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', color: 'rgba(14,12,10,0.5)', padding: '0 12px' }}>
                  <span>Event</span>
                  <span>Platform Fee</span>
                  <span>Bookings</span>
                </div>
                {events.map((e) => (
                  <div
                    key={e.eventId}
                    style={{
                      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', alignItems: 'center',
                      fontSize: '13px', padding: '12px', background: '#fff', borderRadius: '8px',
                      border: '1px solid rgba(14,12,10,0.06)',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{e.title}</span>
                    <span>{money(e.platformFee)}</span>
                    <span>{e.bookings}</span>
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
    <div style={{ background: '#fff', border: '1px solid rgba(14,12,10,0.08)', borderRadius: '10px', padding: '16px' }}>
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
