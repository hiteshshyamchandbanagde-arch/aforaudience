'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import BrandLoader from '@/components/BrandLoader'
import DashboardShell from '@/components/DashboardShell'
import { ErrorBanner } from '@/components/ErrorBanner'
import { STATUS_TONE } from '@/lib/statusStyle'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { formatDate } from '@/lib/format-date'
import { useLocale } from '@/lib/i18n/translate'
import { eventPriceLabel } from '@/components/EventCard'

interface EventItem {
  id: string
  title: string
  type: string
  date: string
  status: string
  totalSeats: number
  isFree: boolean
  ticketPrice: number | null
  priceFromTiers?: boolean
  venue: { name: string; city: string } | null
  applications: { id: string; status: string }[]
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT: { ...STATUS_TONE.gold, label: 'Draft' },
  APPROVED: { ...STATUS_TONE.sage, label: 'Published' },
  PENDING_APPROVAL: { ...STATUS_TONE.gold, label: 'Pending' },
  CANCELLED: { ...STATUS_TONE.error, label: 'Cancelled' },
  COMPLETED: { ...STATUS_TONE.muted, label: 'Completed' },
}

export default function OrganiserDashboard() {
  const { locale, t: tr } = useLocale()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orgStatus, setOrgStatus] = useState<{ isOrganiser: boolean; hasProfile: boolean; isApproved: boolean; orgName?: string | null; walletBalance?: number; payoutAccountLinked?: boolean; payoutAccountStatus?: string | null; directPayoutsEnabled?: boolean } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const fetchStatusAndEvents = async () => {
      try {
        const statusRes = await fetch('/api/organisers/status')
        if (!statusRes.ok) throw new Error('Failed to load account status')
        const statusData = await statusRes.json()
        setOrgStatus(statusData)

        if (statusData.isOrganiser && statusData.isApproved) {
          const res = await fetch('/api/events/my-events')
          if (!res.ok) throw new Error('Failed to fetch events')
          setEvents(await res.json())
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchStatusAndEvents()
    }
  }, [session])

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader /></>)
  if (!session) return <SiteNav />

  if (orgStatus && !orgStatus.isOrganiser) {
    return (
      <>
        <SiteNav />
        <DashboardShell>
        <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'var(--font-sans)' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: 'var(--afa-space-80px) var(--afa-space-6)', textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-heading)', marginBottom: 'var(--afa-space-3)' }}>You're not registered as an Organiser</h1>
            <p style={{ color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-6)' }}>Apply to become an Organiser from your profile to start creating events.</p>
            <BackLink href="/" label="Back to Home" />
          </div>
        </main>
        </DashboardShell>
      </>
    )
  }

  if (orgStatus && orgStatus.isOrganiser && !orgStatus.isApproved) {
    return (
      <>
        <SiteNav />
        <DashboardShell>
        <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'var(--font-sans)' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: 'var(--afa-space-80px) var(--afa-space-6)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--afa-text-page-title-lg)', marginBottom: 'var(--afa-space-2)' }}>⏳</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-heading)', marginBottom: 'var(--afa-space-3)' }}>
              {orgStatus.orgName ? `${orgStatus.orgName} is` : 'Your Organiser account is'} pending approval
            </h1>
            <p style={{ color: 'var(--afa-text-primary)', opacity: 0.6 }}>
              Our team reviews new Organiser applications before you can create and publish events. We'll notify you as soon as you're approved.
            </p>
          </div>
        </main>
        </DashboardShell>
      </>
    )
  }

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: 'var(--afa-space-48px) var(--afa-space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--afa-space-32px)', flexWrap: 'wrap', gap: 'var(--afa-space-4)' }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-page-title-lg)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-6px)' }}>
                Your Events
              </h1>
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>Create events, book venues, and review artist applications</p>
              {!!orgStatus?.walletBalance && orgStatus.walletBalance > 0 && (
                <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-amber)', fontWeight: 600, marginTop: 'var(--afa-space-6px)' }}>
                  💰 Wallet balance: ₹{orgStatus.walletBalance.toLocaleString('en-IN')} <span style={{ fontWeight: 400, opacity: 0.8 }}>(from cancelled Buy-in slots kept as credit)</span>
                </p>
              )}
              {!orgStatus?.payoutAccountLinked ? (
                orgStatus?.directPayoutsEnabled ? (
                  <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6, marginTop: 'var(--afa-space-6px)' }}>
                    <Link href="/dashboard/organiser/payouts" style={{ color: 'var(--afa-fill-solid)', fontWeight: 600 }}>Set up direct payouts →</Link>
                  </p>
                ) : null
              ) : orgStatus.payoutAccountStatus !== 'activated' ? (
                <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-amber)', fontWeight: 600, marginTop: 'var(--afa-space-6px)' }}>
                  ⏳ Payout account linked, not yet activated — <Link href="/dashboard/organiser/payouts" style={{ color: 'inherit' }}>check status</Link>
                </p>
              ) : (
                <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-sage-bright)', fontWeight: 600, marginTop: 'var(--afa-space-6px)' }}>
                  ✓ Direct payouts active
                </p>
              )}
            </div>
            {/* BUG-2609-010: Edit Profile/Sales Overview/Flexible Requests/
                Tours/Create Event are all now sidebar entries
                (DashboardShell's ORGANISER ROLE_SECTIONS) - pendingFlexRequests
                badge moved there too (SidebarLink's own badge prop). */}
          </div>

          {error && (
            <ErrorBanner style={{ marginBottom: 'var(--afa-space-6)' }}>{error}</ErrorBanner>
          )}

          {events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--afa-space-64px) var(--afa-space-6)', background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', border: '1px solid var(--afa-tint-08)' }}>
              <p style={{ fontSize: 'var(--afa-text-title)', color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-2)' }}>No events yet</p>
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-5)' }}>Create your first event to start booking venues and artists</p>
              <Button variant="primary" size="lg" fullWidth={false} href="/dashboard/organiser/events/create">
                Create Event
              </Button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--afa-space-5)' }}>
              {events.map((event) => {
                const pendingApplications = event.applications.filter((a) => a.status === 'PENDING').length
                const statusStyle = STATUS_STYLE[event.status] || STATUS_STYLE.DRAFT
                return (
                  <div
                    key={event.id}
                    onClick={() => router.push(`/dashboard/organiser/events/${event.id}`)}
                    style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-6)', border: '1px solid var(--afa-tint-08)', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--afa-space-14px)', gap: 'var(--afa-space-10px)' }}>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{event.title}</h3>
                        <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6, marginTop: 'var(--afa-space-2px)' }}>
                          {formatDate(event.date, 'medium', locale)} · {event.venue ? `${event.venue.name}, ${event.venue.city}` : 'No venue booked'}
                        </p>
                      </div>
                      <Badge tone={statusStyle}>{statusStyle.label}</Badge>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--afa-space-4)', marginBottom: 'var(--afa-space-18px)', fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', flexWrap: 'wrap' }}>
                      <span><strong>{event.totalSeats}</strong> seats</span>
                      <span><strong>{event.isFree ? 'Free' : eventPriceLabel(event, tr)}</strong></span>
                      {pendingApplications > 0 && (
                        <span style={{ color: 'var(--afa-fill-solid)', fontWeight: 600 }}>{pendingApplications} pending application{pendingApplications > 1 ? 's' : ''}</span>
                      )}
                    </div>

                    <div data-afa-action-row style={{ display: 'flex', gap: 'var(--afa-space-10px)' }}>
                      <Link
                        href={`/dashboard/organiser/events/${event.id}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ flex: 1, textAlign: 'center', fontSize: 'var(--afa-text-ui)', fontWeight: 600, color: 'var(--afa-text-primary)', border: '1px solid var(--afa-border-resting)', textDecoration: 'none', padding: '9px 0', borderRadius: 'var(--afa-radius-md)' }} // token-ok(spacing-literal): 9px odd value, no exact token (GEN-2609-107)
                      >
                        View
                      </Link>
                      <Link
                        href={`/dashboard/organiser/events/${event.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        // GEN-2609-118 - a secondary action beside View, so the same outline; orange is for a screen's one primary action.
                        style={{ flex: 1, textAlign: 'center', fontSize: 'var(--afa-text-ui)', fontWeight: 600, color: 'var(--afa-text-primary)', border: '1px solid var(--afa-border-resting)', textDecoration: 'none', padding: '9px 0', borderRadius: 'var(--afa-radius-md)' }} // token-ok(spacing-literal): 9px odd value, no exact token (GEN-2609-107)
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
      </DashboardShell>
    </>
  )
}
