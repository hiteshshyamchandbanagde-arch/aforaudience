'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'

// /dashboard/admin — Command Center (design.md §9.6, session 47)
//
// v2 (same session, redesign pass): the first cut worked but read as a
// generic stat-card grid — "boring" per direct feedback. This pass leans
// into what the platform actually is: a live-events ticketing brand.
// KPI tiles are styled as torn ticket stubs (punched side-notches, a
// perforation line separating a stub icon from the number) rather than
// plain cards — the one deliberate visual signature, kept restrained
// everywhere else. Quick links are icon+label pills, no arrow glyphs.

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

// --- Minimal line icons (18x18, stroke-only, one weight) ------------------
// Kept deliberately plain and monochrome — the ticket-stub shape carries
// the personality, icons just need to be legible at a glance.

function IconClipboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <line x1="9" y1="11" x2="15" y2="11" />
      <line x1="9" y1="15" x2="13" y2="15" />
    </svg>
  )
}
function IconClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 12V7M12 12l3.5 2" />
    </svg>
  )
}
function IconFlask() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 3h5M10 3v5.5l-4.6 8.2A2 2 0 0 0 7.2 20h9.6a2 2 0 0 0 1.8-3.3L14 8.5V3" />
      <path d="M8.5 14.5h7" />
    </svg>
  )
}
function IconCheckCircle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.2 12.3l2.6 2.6 5-5.6" />
    </svg>
  )
}
function IconBulb() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.3 18.5h5.4M10.3 21h3.4" />
      <path d="M12 3.2a6.3 6.3 0 0 0-3.6 11.4c.6.4.9 1.1.9 1.8v.6h5.4v-.6c0-.7.3-1.4.9-1.8A6.3 6.3 0 0 0 12 3.2z" />
    </svg>
  )
}
function IconTicket() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.2a2 2 0 0 0 0 3.6V15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.2a2 2 0 0 0 0-3.6V9z" />
      <line x1="12.5" y1="7.5" x2="12.5" y2="16.5" strokeDasharray="2.2 2.2" />
    </svg>
  )
}
function IconRupee() {
  return <span style={{ fontSize: '15px', fontWeight: 700, lineHeight: 1 }}>₹</span>
}
function IconChat() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16v11H9l-4 4V5z" />
    </svg>
  )
}
function IconUsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19.5c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" />
      <circle cx="17" cy="9.5" r="2.2" />
      <path d="M15.8 19.5c.2-2.2 1.8-3.9 3.7-4.2" />
    </svg>
  )
}
function IconGear() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M4.4 4.4l2.1 2.1M17.5 17.5l2.1 2.1M2.5 12h3M18.5 12h3M4.4 19.6l2.1-2.1M17.5 6.5l2.1-2.1" />
    </svg>
  )
}
function IconBars() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 20V11M11 20V4M17 20v-8" />
    </svg>
  )
}

// --- Ticket-stub KPI tile --------------------------------------------------
// Perforation notches punched into the left/right edges (colored to match
// the page background so they read as cut-through), plus a dashed
// tear-line separating the icon "stub" zone from the number. Grounded in
// what this platform actually sells: tickets.

function TicketTile({ icon, value, label, accent }: { icon: React.ReactNode; value: React.ReactNode; label: string; accent: string }) {
  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--afa-white)',
        borderRadius: '10px',
        border: '1px solid var(--afa-ink-a8)',
        display: 'flex',
        alignItems: 'stretch',
        overflow: 'hidden',
        minHeight: '84px',
      }}
    >
      <span
        aria-hidden
        style={{ position: 'absolute', left: '-9px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--afa-cream)' }}
      />
      <span
        aria-hidden
        style={{ position: 'absolute', right: '-9px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--afa-cream)' }}
      />
      <div
        style={{
          width: '46px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${accent}14`,
          color: accent,
          borderRight: '1px dashed var(--afa-ink-a13)',
        }}
      >
        {icon}
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: 700, color: 'var(--afa-ink)', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
          {value}
        </div>
        <div style={{ fontSize: '11.5px', color: 'var(--afa-taupe)', marginTop: '3px' }}>{label}</div>
      </div>
    </div>
  )
}

function QuickLink({ href, icon, label, accent }: { href: string; icon: React.ReactNode; label: string; accent: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--afa-ink)',
        background: 'var(--afa-white)',
        border: '1px solid var(--afa-ink-a8)',
        borderBottom: `2.5px solid ${accent}`,
        borderRadius: '10px',
        padding: '9px 16px',
        textDecoration: 'none',
      }}
    >
      <span style={{ color: accent, display: 'flex' }}>{icon}</span>
      {label}
    </Link>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: 'var(--afa-taupe)',
  textTransform: 'uppercase',
  marginBottom: '10px',
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
        <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '26px' }}>
          Everything that needs your attention, at a glance.
        </p>

        {/* Needs attention — only rendered if something is actually outstanding */}
        {data && data.attention.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={sectionLabel}>Needs attention</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.attention.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  style={{
                    background: 'var(--afa-white)',
                    borderRadius: '10px',
                    border: '1px solid var(--afa-ink-a8)',
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
                      background: a.tone === 'critical' ? 'var(--afa-error-border)' : 'var(--afa-ink-a8)',
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
          <div
            style={{
              marginBottom: '28px',
              background: 'var(--afa-mint-tint)',
              border: '1px solid var(--afa-ink-a8)',
              borderLeft: '4px solid var(--afa-sage)',
              borderRadius: '10px',
              padding: '14px 18px',
              color: 'var(--afa-sage)',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Nothing needs attention right now — all clear.
          </div>
        )}

        {/* Feedback health */}
        <div style={{ marginBottom: '10px' }}>
          <div style={sectionLabel}>Feedback health</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
            <TicketTile icon={<IconClipboard />} value={k?.totalFeedback ?? '—'} label="Total reported" accent="var(--afa-ink)" />
            <TicketTile icon={<IconClock />} value={k?.pending ?? '—'} label="Pending" accent="var(--afa-gold)" />
            <TicketTile icon={<IconFlask />} value={k?.tested ?? '—'} label="Tested" accent="var(--afa-plum)" />
            <TicketTile icon={<IconCheckCircle />} value={k?.resolved ?? '—'} label="Resolved" accent="var(--afa-sage)" />
            <TicketTile icon={<IconBulb />} value={k?.featureIdeas ?? '—'} label="Feature ideas" accent="var(--afa-amber)" />
          </div>
        </div>

        {/* Business this month */}
        <div style={{ marginTop: '24px', marginBottom: '24px' }}>
          <div style={sectionLabel}>This month</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
            <TicketTile icon={<IconRupee />} value={k ? formatINR(k.monthRevenue) : '—'} label="Revenue" accent="var(--afa-forest)" />
            <TicketTile icon={<IconTicket />} value={k?.monthBookings ?? '—'} label="Bookings" accent="var(--afa-terracotta)" />
          </div>
        </div>

        {/* 14-day daily trend */}
        <div
          style={{
            background: 'var(--afa-white)',
            borderRadius: '14px',
            border: '1px solid var(--afa-ink-a8)',
            padding: '20px 22px',
            marginBottom: '26px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '16px' }}>
            Issues raised vs. resolved <span style={{ opacity: 0.5, fontWeight: 400 }}>· last 14 days</span>
          </div>
          <div style={{ position: 'relative', height: '130px' }}>
            {/* subtle gridlines */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ borderTop: '1px solid var(--afa-ink-a8)' }} />
              ))}
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: '6px', height: '100%' }}>
              {(data?.dailyTrend || []).map((d) => (
                <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '108px' }}>
                    <div
                      title={`Opened: ${d.opened}`}
                      style={{ width: '10px', height: `${Math.max(2, (d.opened / maxDaily) * 108)}px`, background: 'var(--afa-terracotta)', borderRadius: '3px 3px 0 0' }}
                    />
                    <div
                      title={`Resolved: ${d.resolved}`}
                      style={{ width: '10px', height: `${Math.max(2, (d.resolved / maxDaily) * 108)}px`, background: 'var(--afa-sage)', borderRadius: '3px 3px 0 0' }}
                    />
                  </div>
                  <span style={{ fontSize: '9.5px', color: 'var(--afa-taupe)', marginTop: '6px' }}>{dayLabel(d.day)}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '14px', fontSize: '11.5px' }}>
            <span style={{ color: 'var(--afa-terracotta)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--afa-terracotta)', display: 'inline-block' }} /> Opened
            </span>
            <span style={{ color: 'var(--afa-sage)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--afa-sage)', display: 'inline-block' }} /> Resolved
            </span>
          </div>
        </div>

        {/* Quick links */}
        <div style={sectionLabel}>Go to</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <QuickLink href="/dashboard/admin/feedback" icon={<IconChat />} label="Feedback board" accent="var(--afa-ink)" />
          <QuickLink href="/dashboard/admin/bookings" icon={<IconTicket />} label="Bookings" accent="var(--afa-terracotta)" />
          <QuickLink href="/dashboard/admin/revenue" icon={<IconBars />} label="Revenue" accent="var(--afa-forest)" />
          <QuickLink href="/dashboard/admin/users" icon={<IconUsersIcon />} label="Users" accent="var(--afa-plum)" />
          <QuickLink href="/dashboard/admin/settings" icon={<IconGear />} label="Settings" accent="var(--afa-taupe)" />
        </div>
      </main>
    </>
  )
}
