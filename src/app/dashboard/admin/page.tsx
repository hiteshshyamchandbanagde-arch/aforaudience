'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'

// /dashboard/admin — Command Center (design.md §9.6, session 47)
//
// Replaces the old stub that just redirected straight into the Feedback
// board. An admin landing here should see the state of the platform in
// one glance — what needs attention right now, headline numbers, and a
// 14-day trend — before choosing where to go next. Everything below is
// read-only; actions (approve, resolve, retry delivery) still happen on
// their respective sub-pages, reached via the Quick links row.

interface CommandCenterData {
  kpis: {
    totalFeedback: number
    pending: number
    tested: number
    resolved: number
    featureIdeas: number
    pendingApprovals: number
    monthRevenue: number
    monthBookings: number
    erroredDeliveries: number
  }
  attention: { label: string; count: number; href: string; tone: 'critical' | 'warning' }[]
  dailyTrend: { day: string; opened: number; resolved: number }[]
  generatedAt: string
}

function formatINR(rupees: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(rupees)
}

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const card: React.CSSProperties = {
  background: 'var(--afa-white)',
  borderRadius: '14px',
  border: '1px solid rgba(14,12,10,0.08)',
  padding: '18px 20px',
}

const kpiValue: React.CSSProperties = {
  fontFamily: 'Georgia, serif',
  fontSize: '30px',
  fontWeight: 700,
  color: 'var(--afa-ink)',
  lineHeight: 1.1,
}

const kpiLabel: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--afa-taupe)',
  marginTop: '4px',
}

const quickLinkStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--afa-ink)',
  background: 'var(--afa-white)',
  border: '1px solid rgba(14,12,10,0.12)',
  borderRadius: '999px',
  padding: '8px 16px',
  textDecoration: 'none',
  display: 'inline-block',
}

export default function AdminCommandCenter() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<CommandCenterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (!session?.user) return
    ;(async () => {
      setLoading(true)
      const res = await fetch('/api/admin/command-center')
      if (res.status === 403) {
        setForbidden(true)
        setLoading(false)
        return
      }
      if (res.ok) setData(await res.json())
      setLoading(false)
    })()
  }, [session])

  if (status === 'loading' || loading) {
    return (
      <>
        <SiteNav />
        <BrandLoader />
      </>
    )
  }
  if (!session) return <SiteNav />

  if (forbidden) {
    return (
      <>
        <SiteNav />
        <main style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 20px' }}>
          <p style={{ fontSize: '15px', color: 'var(--afa-ink)' }}>Admin access required.</p>
        </main>
      </>
    )
  }

  const k = data?.kpis
  const maxDaily = Math.max(1, ...(data?.dailyTrend || []).map((d) => Math.max(d.opened, d.resolved)))

  return (
    <>
      <SiteNav />
      <main style={{ maxWidth: '1080px', margin: '0 auto', padding: '32px 20px 64px' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '4px' }}>
          Command Center
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '24px' }}>
          Everything that needs your attention, at a glance.
        </p>

        {/* Needs attention — only rendered if something is actually outstanding */}
        {data && data.attention.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--afa-ink)', opacity: 0.7, marginBottom: '8px' }}>
              NEEDS ATTENTION
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.attention.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  style={{
                    ...card,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    textDecoration: 'none',
                    borderLeft: `4px solid ${a.tone === 'critical' ? 'var(--afa-error)' : 'var(--afa-gold)'}`,
                    padding: '14px 18px',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-ink)' }}>{a.label}</span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: a.tone === 'critical' ? 'var(--afa-error)' : 'var(--afa-ink)',
                      background: a.tone === 'critical' ? 'var(--afa-error-border)' : 'rgba(14,12,10,0.06)',
                      borderRadius: '999px',
                      padding: '2px 10px',
                    }}
                  >
                    {a.count}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
        {data && data.attention.length === 0 && (
          <div style={{ ...card, marginBottom: '24px', color: 'var(--afa-sage)', fontSize: '13px', fontWeight: 600 }}>
            Nothing needs attention right now — all clear.
          </div>
        )}

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '24px' }}>
          <div style={card}>
            <div style={kpiValue}>{k?.totalFeedback ?? '—'}</div>
            <div style={kpiLabel}>Total reported</div>
          </div>
          <div style={card}>
            <div style={kpiValue}>{k?.pending ?? '—'}</div>
            <div style={kpiLabel}>Pending</div>
          </div>
          <div style={card}>
            <div style={kpiValue}>{k?.tested ?? '—'}</div>
            <div style={kpiLabel}>Tested</div>
          </div>
          <div style={card}>
            <div style={kpiValue}>{k?.resolved ?? '—'}</div>
            <div style={kpiLabel}>Resolved</div>
          </div>
          <div style={card}>
            <div style={kpiValue}>{k?.featureIdeas ?? '—'}</div>
            <div style={kpiLabel}>Feature ideas</div>
          </div>
          <div style={card}>
            <div style={kpiValue}>{k ? formatINR(k.monthRevenue) : '—'}</div>
            <div style={kpiLabel}>Revenue this month</div>
          </div>
          <div style={card}>
            <div style={kpiValue}>{k?.monthBookings ?? '—'}</div>
            <div style={kpiLabel}>Bookings this month</div>
          </div>
        </div>

        {/* 14-day daily trend */}
        <div style={{ ...card, marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '14px' }}>
            Issues raised vs. resolved <span style={{ opacity: 0.5, fontWeight: 400 }}>· last 14 days</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px' }}>
            {(data?.dailyTrend || []).map((d) => (
              <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '90px' }}>
                  <div
                    title={`Opened: ${d.opened}`}
                    style={{ width: '8px', height: `${Math.max(2, (d.opened / maxDaily) * 90)}px`, background: 'var(--afa-terracotta)', borderRadius: '2px 2px 0 0' }}
                  />
                  <div
                    title={`Resolved: ${d.resolved}`}
                    style={{ width: '8px', height: `${Math.max(2, (d.resolved / maxDaily) * 90)}px`, background: 'var(--afa-sage)', borderRadius: '2px 2px 0 0' }}
                  />
                </div>
                <span style={{ fontSize: '9px', color: 'var(--afa-taupe)', marginTop: '5px' }}>{dayLabel(d.day)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '14px', marginTop: '10px', fontSize: '11px' }}>
            <span style={{ color: 'var(--afa-terracotta)' }}>● Opened</span>
            <span style={{ color: 'var(--afa-sage)' }}>● Resolved</span>
          </div>
        </div>

        {/* Quick links */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link href="/dashboard/admin/feedback" style={quickLinkStyle}>Feedback board →</Link>
          <Link href="/dashboard/admin/bookings" style={quickLinkStyle}>Bookings →</Link>
          <Link href="/dashboard/admin/revenue" style={quickLinkStyle}>Revenue →</Link>
          <Link href="/dashboard/admin/users" style={quickLinkStyle}>Users →</Link>
          <Link href="/dashboard/admin/settings" style={quickLinkStyle}>Settings →</Link>
        </div>
      </main>
    </>
  )
}
