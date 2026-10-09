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
import { useLocale, type Dictionary } from '@/lib/i18n/translate'
import { countText } from '@/lib/i18n/plural'
import { eventPriceLabel } from '@/components/EventCard'
import { isPastEvent } from '@/lib/application-status'
import { PageTitle } from '@/components/dashboard/PageTitle'
import { formatINR } from '@/lib/money-display'
import { Icon, INLINE_ICON_STYLE } from '@/components/Icon'

interface EventItem {
  id: string
  title: string
  type: string
  date: string
  startTime?: string
  status: string
  totalSeats: number
  isFree: boolean
  ticketPrice: number | null
  priceFromTiers?: boolean
  venue: { name: string; city: string } | null
  applications: { id: string; status: string }[]
}

// GEN-2610-007 - the badge's label in the UI language; the stored status stays English.
type YourEventsText = Dictionary['organiserDashboard']['yourEvents']
const STATUS_STYLE: Record<string, { bg: string; color: string; label: keyof YourEventsText }> = {
  DRAFT: { ...STATUS_TONE.gold, label: 'statusDraft' },
  APPROVED: { ...STATUS_TONE.sage, label: 'statusPublished' },
  PENDING_APPROVAL: { ...STATUS_TONE.gold, label: 'statusPending' },
  CANCELLED: { ...STATUS_TONE.error, label: 'statusCancelled' },
  COMPLETED: { ...STATUS_TONE.muted, label: 'statusCompleted' },
}

/** A count text with its number in bold: "<strong>4</strong> seats". */
function boldCount(locale: string, n: number, one: string, other: string) {
  const [before, after = ''] = countText(locale, n, one.replace('{n}', '{b}'), other.replace('{n}', '{b}')).split('{b}')
  return <>{before}<strong>{n}</strong>{after}</>
}

export default function OrganiserDashboard() {
  const { locale, t: tr } = useLocale()
  const o = tr.organiserDashboard.yourEvents
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
        if (!statusRes.ok) throw new Error(o.statusLoadFailed)
        const statusData = await statusRes.json()
        setOrgStatus(statusData)

        if (statusData.isOrganiser && statusData.isApproved) {
          const res = await fetch('/api/events/my-events')
          if (!res.ok) throw new Error(o.eventsLoadFailed)
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

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader label={tr.dashboardChrome.loading} /></>)
  if (!session) return <SiteNav />

  if (orgStatus && !orgStatus.isOrganiser) {
    return (
      <>
        <SiteNav />
        <DashboardShell>
        <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'var(--font-sans)' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: 'var(--afa-space-80px) var(--afa-space-6)', textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-heading)', marginBottom: 'var(--afa-space-3)' }}>{o.notOrganiserTitle}</h1>
            <p style={{ color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-6)' }}>{o.notOrganiserBody}</p>
            <BackLink href="/" label={o.backToHome} />
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
            <div style={{ fontSize: 'var(--afa-text-page-title-lg)', marginBottom: 'var(--afa-space-2)' }}><Icon name="clock" size={32} /></div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-heading)', marginBottom: 'var(--afa-space-3)' }}>
              {orgStatus.orgName ? o.orgPendingTitle.replace('{org}', orgStatus.orgName) : o.accountPendingTitle}
            </h1>
            <p style={{ color: 'var(--afa-text-primary)', opacity: 0.6 }}>
              {o.pendingBody}
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
              <PageTitle size="lg" style={{ marginBottom: 'var(--afa-space-6px)' }}>
                {o.title}
              </PageTitle>
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>{o.subtitle}</p>
              {!!orgStatus?.walletBalance && orgStatus.walletBalance > 0 && (
                <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-amber)', fontWeight: 600, marginTop: 'var(--afa-space-6px)' }}>
                  <Icon name="wallet" size={14} style={INLINE_ICON_STYLE} /> {o.walletBalance.replace('{amount}', formatINR(orgStatus.walletBalance))} <span style={{ fontWeight: 400, opacity: 0.8 }}>{o.walletBalanceNote}</span>
                </p>
              )}
              {!orgStatus?.payoutAccountLinked ? (
                orgStatus?.directPayoutsEnabled ? (
                  <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6, marginTop: 'var(--afa-space-6px)' }}>
                    <Link href="/dashboard/organiser/payouts" style={{ color: 'var(--afa-fill-solid)', fontWeight: 600 }}>{o.setUpPayouts}</Link>
                  </p>
                ) : null
              ) : orgStatus.payoutAccountStatus !== 'activated' ? (
                <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-amber)', fontWeight: 600, marginTop: 'var(--afa-space-6px)' }}>
                  <Icon name="clock" size={14} style={INLINE_ICON_STYLE} /> {o.payoutNotActivated} <Link href="/dashboard/organiser/payouts" style={{ color: 'inherit' }}>{o.checkStatus}</Link>
                </p>
              ) : (
                <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-sage-bright)', fontWeight: 600, marginTop: 'var(--afa-space-6px)' }}>
                  {o.payoutsActive}
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
              <p style={{ fontSize: 'var(--afa-text-title)', color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-2)' }}>{o.noEventsTitle}</p>
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-5)' }}>{o.noEventsBody}</p>
              <Button variant="primary" size="lg" fullWidth={false} href="/dashboard/organiser/events/create">
                {o.createEvent}
              </Button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--afa-space-5)' }}>
              {events.map((event) => {
                // BUG-2610-022 - an application for a past event can no longer be decided: not pending.
                const pendingApplications = isPastEvent(event) ? 0 : event.applications.filter((a) => a.status === 'PENDING').length
                const statusStyle = STATUS_STYLE[event.status] || STATUS_STYLE.DRAFT
                return (
                  <div
                    key={event.id}
                    data-afa-event-card={event.id}
                    onClick={() => router.push(`/dashboard/organiser/events/${event.id}`)}
                    style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-6)', border: '1px solid var(--afa-tint-08)', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--afa-space-14px)', gap: 'var(--afa-space-10px)' }}>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{event.title}</h3>
                        <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6, marginTop: 'var(--afa-space-2px)' }}>
                          {formatDate(event.date, 'medium', locale)} · {event.venue ? `${event.venue.name}, ${event.venue.city}` : o.noVenueBooked}
                        </p>
                      </div>
                      <Badge tone={statusStyle} data-afa-status={event.status}>{o[statusStyle.label]}</Badge>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--afa-space-4)', marginBottom: 'var(--afa-space-18px)', fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', flexWrap: 'wrap' }}>
                      <span>{boldCount(locale, event.totalSeats, o.seatsOne, o.seatsOther)}</span>
                      <span><strong>{event.isFree ? o.free : eventPriceLabel(event, tr)}</strong></span>
                      {pendingApplications > 0 && (
                        <span data-afa-pending-count={pendingApplications} style={{ color: 'var(--afa-fill-solid)', fontWeight: 600 }}>{countText(locale, pendingApplications, o.pendingApplicationsOne, o.pendingApplicationsOther)}</span>
                      )}
                    </div>

                    <div data-afa-action-row style={{ display: 'flex', gap: 'var(--afa-space-10px)' }}>
                      <Link
                        href={`/dashboard/organiser/events/${event.id}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ flex: 1, textAlign: 'center', fontSize: 'var(--afa-text-ui)', fontWeight: 600, color: 'var(--afa-text-primary)', border: '1px solid var(--afa-border-resting)', textDecoration: 'none', padding: '9px 0', borderRadius: 'var(--afa-radius-md)' }} // token-ok(spacing-literal): 9px odd value, no exact token (GEN-2609-107)
                      >
                        {o.view}
                      </Link>
                      <Link
                        href={`/dashboard/organiser/events/${event.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        // GEN-2609-118 - a secondary action beside View, so the same outline; orange is for a screen's one primary action.
                        style={{ flex: 1, textAlign: 'center', fontSize: 'var(--afa-text-ui)', fontWeight: 600, color: 'var(--afa-text-primary)', border: '1px solid var(--afa-border-resting)', textDecoration: 'none', padding: '9px 0', borderRadius: 'var(--afa-radius-md)' }} // token-ok(spacing-literal): 9px odd value, no exact token (GEN-2609-107)
                      >
                        {o.edit}
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
