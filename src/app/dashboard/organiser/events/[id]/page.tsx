'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import PosterShareCard from '@/components/PosterShareCard'
import { formatEventTimeRange } from '@/lib/eventTime'
import { useToast } from '@/components/Toast'
import BrandLoader from '@/components/BrandLoader'
import DashboardShell from '@/components/DashboardShell'
import Button from '@/components/ui/Button'
import { STATUS_TONE } from '@/lib/statusStyle'
import { formatDate } from '@/lib/format-date'
import { useLocale, type Dictionary } from '@/lib/i18n/translate'
import { displayApplicationStatus } from '@/lib/application-status'
import { PageTitle } from '@/components/dashboard/PageTitle'
import { formatINR } from '@/lib/money-display'
import { Icon, INLINE_ICON_STYLE } from '@/components/Icon'

interface Application {
  id: string
  message: string
  status: string
  createdAt: string
  artist: { id: string; stageName?: string; user: { name: string; email: string } }
}

interface Performance {
  id: string
  slot: number
  duration: number
  artistId: string
  compensationType: 'PAID' | 'FREE' | 'BUY_IN'
  buyInAmount: number | null
  cancelledAt: string | null
  buyInRefundStatus: 'REFUNDED' | 'WALLET_CREDITED' | null
  artist: { stageName?: string | null; user: { name: string; displayName: string | null } }
}

interface EventDetail {
  id: string
  title: string
  description: string
  type: string
  status: string
  date: string
  startTime: string
  endTime: string
  isFree: boolean
  ticketPrice: number | null
  ticketTiers?: { id: string; sectionName: string; price: number; totalSeats: number }[]
  totalSeats: number
  availableSeats: number
  dresscode?: string | null
  vibe?: string | null
  surpriseAct: boolean
  defaultCompensationType?: 'PAID' | 'FREE' | 'BUY_IN'
  defaultFeeAmount?: number | null
  defaultBuyInAmount?: number | null
  venue: { id: string; name: string; city: string; address: string } | null
  applications: Application[]
  lineup: Performance[]
  venueBooking: { id: string; status: string; amount: number; fromDate: string; toDate: string; platformFeeAmount: number | null } | null
}

// GEN-2610-007 - the badge's label in the UI language (the Your Events
// list's labels); the stored status stays English.
type DetailText = Dictionary['organiserDashboard']['eventDetail']
const STATUS_STYLE: Record<string, { bg: string; color: string; label: keyof Dictionary['organiserDashboard']['yourEvents'] }> = {
  DRAFT: { ...STATUS_TONE.gold, label: 'statusDraft' },
  APPROVED: { ...STATUS_TONE.sage, label: 'statusPublished' },
  PENDING_APPROVAL: { ...STATUS_TONE.gold, label: 'statusPending' },
  CANCELLED: { ...STATUS_TONE.error, label: 'statusCancelled' },
  COMPLETED: { bg: 'var(--afa-tint-08)', color: 'var(--afa-text-primary)', label: 'statusCompleted' },
}

function applicationStatusLabel(status: string, chrome: Dictionary['dashboardChrome']): string {
  switch (status) {
    case 'PENDING': return chrome.applicationPending
    case 'APPROVED': return chrome.applicationApproved
    case 'REJECTED': return chrome.applicationRejected
    case 'WAITLISTED': return chrome.applicationWaitlisted
    default: return status.toLowerCase()
  }
}

function bookingStatusLabel(status: string, d: DetailText): string {
  switch (status) {
    case 'PENDING': return d.bookingPending
    case 'CONFIRMED': return d.bookingConfirmed
    case 'CANCELLED': return d.bookingCancelled
    case 'REFUNDED': return d.bookingRefunded
    default: return d.bookingOther.replace('{status}', status.toLowerCase())
  }
}

const APPLICATION_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING: { ...STATUS_TONE.gold },
  APPROVED: { ...STATUS_TONE.sage },
  REJECTED: { ...STATUS_TONE.error },
  // Applied when the lineup was full at application time (Hitesh's own
  // admin note, 22 Jul) - a real FCFS queue instead of a hard rejection.
  // No auto-promotion on cancellation exists yet (separate gap), so an
  // Organiser promotes manually the same way as any pending applicant -
  // the Approve/Reject UI below is enabled for WAITLISTED too.
  WAITLISTED: { ...STATUS_TONE.gold },
  // BUG-2610-022 - still undecided, but the event has happened: nothing
  // left to decide, so a neutral pill and no Approve/Reject.
  CLOSED: { ...STATUS_TONE.muted },
}

function describeDefaultCompensation(event: EventDetail, d: DetailText): string {
  const t = event.defaultCompensationType || 'FREE'
  if (t === 'FREE') return d.compFree
  const withAmount = (label: string, amount: number | null | undefined) =>
    amount ? d.compWithAmount.replace('{label}', label).replace('{amount}', formatINR(amount)) : label
  if (t === 'PAID') return withAmount(d.compPaid, event.defaultFeeAmount)
  return withAmount(d.compBuyIn, event.defaultBuyInAmount)
}

export default function OrganiserEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { t: tr, locale } = useLocale()
  const d = tr.organiserDashboard.eventDetail
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { showToast } = useToast()
  const [toggling, setToggling] = useState(false)
  const [actingOn, setActingOn] = useState<string | null>(null)
  const [walletBalance, setWalletBalance] = useState(0)
  const [applyingWallet, setApplyingWallet] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/events/${id}/owner`)
      if (!res.ok) {
        if (res.status === 403) throw new Error(d.noAccess)
        throw new Error(d.notFound)
      }
      const data = await res.json()
      setEvent(data)

      const statusRes = await fetch('/api/organisers/status')
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        setWalletBalance(statusData.walletBalance || 0)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const applyWalletCredit = async () => {
    if (!event?.venueBooking) return
    setApplyingWallet(true)
    try {
      const res = await fetch(`/api/venue-bookings/${event.venueBooking.id}/apply-wallet`, { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || d.applyWalletFailed)
      await fetchEvent()
      showToast(d.walletCreditApplied.replace('{amount}', formatINR(data.applied)), 'success')
    } catch (err: any) {
      showToast(err.message || d.applyWalletFailed, 'error')
    } finally {
      setApplyingWallet(false)
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchEvent()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id])

  const togglePublish = async () => {
    if (!event) return
    setToggling(true)
    const willPublish = event.status !== 'APPROVED'
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish: willPublish }),
      })
      if (!res.ok) throw new Error(d.publishFailed)
      const updated = await res.json()
      // PATCH /api/events/[id] intentionally returns a bare
      // prisma.event.update() result with no relations - venue,
      // applications, lineup, ticketTiers, panelists are all absent. This
      // page renders several of those unconditionally (event.venue.name,
      // event.lineup.some(...), event.applications.length) with no
      // optional chaining, so setEvent(updated) here used to crash the
      // page immediately after every single Publish/Unpublish click, for
      // every event with a venue attached - confirmed 100% reproducible,
      // unrelated to Competition Show or venue-approval status (found
      // during PR #300 click-testing, 31 Jul). Refetch the same rich
      // shape the page loaded with initially instead, matching the
      // pattern applyWalletCredit already uses above after its own
      // state-changing PATCH.
      await fetchEvent()
      // The server re-checks the venue booking's confirmation status on
      // every call - clicking "publish" on an already-pending event isn't
      // a no-op, it's a legitimate recheck (useful if the venue owner
      // approved since the page last loaded). The toast used to always
      // say "Event published." regardless of what actually came back,
      // which was misleading when the real result was still pending.
      if (!willPublish) {
        showToast(d.eventUnpublished, 'success')
      } else if (updated.status === 'APPROVED') {
        showToast(d.eventPublished, 'success')
      } else if (updated.status === 'PENDING_APPROVAL') {
        showToast(d.submittedWaiting, 'success')
      } else {
        showToast(d.eventUpdated, 'success')
      }
    } catch (err: any) {
      showToast(err.message || d.publishFailed, 'error')
    } finally {
      setToggling(false)
    }
  }

  const reviewApplication = async (applicationId: string, newStatus: 'APPROVED' | 'REJECTED') => {
    setActingOn(applicationId)
    try {
      // Approval no longer carries a per-artist compensation override — the
      // terms an artist applied under (event's declared default) are final
      // once approved. The API falls back to the event's own declared
      // default whenever these fields are omitted (see
      // /api/applications/[id]/route.ts).
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || d.updateApplicationFailed)
      }
      await fetchEvent()
      showToast(newStatus === 'APPROVED' ? d.applicationApproved : d.applicationRejected, 'success')
    } catch (err: any) {
      showToast(err.message || d.updateApplicationFailed, 'error')
    } finally {
      setActingOn(null)
    }
  }

  // Organiser-only override: keeps a cancelled Buy-in artist's amount as
  // wallet credit instead of the default refund. Never the reverse, never
  // the artist's call - see the API route's own comment for the reasoning.
  const convertToWalletCredit = async (performanceId: string) => {
    setActingOn(performanceId)
    try {
      const res = await fetch(`/api/performances/${performanceId}/refund-status`, { method: 'PATCH' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || d.updateFailed)
      }
      await fetchEvent()
      showToast(d.keptAsWalletCredit, 'success')
    } catch (err: any) {
      showToast(err.message || d.updateFailed, 'error')
    } finally {
      setActingOn(null)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><DashboardShell><BrandLoader label={tr.dashboardChrome.loading} /></DashboardShell></>)
  if (!session) return (<><SiteNav /><DashboardShell>{null}</DashboardShell></>)
  if (error && !event) return (<><SiteNav /><DashboardShell><div style={{ padding: 'var(--afa-space-32px)', color: 'var(--afa-error-bright)' }}>{error}</div></DashboardShell></>)
  if (!event) return (<><SiteNav /><DashboardShell><div style={{ padding: 'var(--afa-space-32px)' }}>{d.notFound}</div></DashboardShell></>)

  const statusStyle = STATUS_STYLE[event.status] || STATUS_STYLE.DRAFT

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: 'var(--afa-space-48px) var(--afa-space-6)' }}>
          <BackLink href="/dashboard/organiser" label={d.backToEvents} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 'var(--afa-space-4)', marginBottom: 'var(--afa-space-28px)', gap: 'var(--afa-space-4)', flexWrap: 'wrap' }}>
            <div>
              <PageTitle size="lg" style={{ marginBottom: 'var(--afa-space-6px)' }}>
                {event.title}
              </PageTitle>
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>
                {formatDate(event.date, 'medium', locale)} · {formatEventTimeRange(event.startTime, event.endTime).replace(' (next day)', ` (${d.nextDay})`)}
              </p>
            </div>
            <span
              style={{
                fontSize: 'var(--afa-text-small)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                padding: 'var(--afa-space-6px) var(--afa-space-14px)', borderRadius: 'var(--afa-radius-pill)', background: statusStyle.bg, color: statusStyle.color, whiteSpace: 'nowrap',
              }}
            >
              {tr.organiserDashboard.yourEvents[statusStyle.label]}
            </span>
          </div>

          <div style={{ marginBottom: 'var(--afa-space-5)' }}>
            {event.venueBooking?.status === 'CONFIRMED' ? (
              <PosterShareCard
                src={`/api/posters/organiser/${event.id}`}
                filename={`${event.title}-poster.png`}
                title={event.title}
              />
            ) : (
              // Poster generation 404s until the venue booking is
              // CONFIRMED (see /api/posters/organiser/[eventId] - by
              // design, Session 39: date/venue/lineup can still change
              // while pending). Before this fix the card rendered
              // anyway, showing a broken image and a Share button that
              // would always fail. Found via live device test 29 Jul.
              <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-title)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-2)' }}>
                  {d.sharePosterTitle}
                </h3>
                <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>
                  {event.venue ? d.posterAfterConfirm : d.posterAfterBooking}
                </p>
              </div>
            )}
          </div>

          {/* Overview */}
          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
            <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.8, marginBottom: 'var(--afa-space-5)', lineHeight: 1.6 }}>{event.description}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--afa-space-5)' }}>
              <div>
                <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: 'var(--afa-space-1)' }}>{d.seats}</p>
                <p style={{ fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{d.seatsAvailable.replace('{available}', String(event.availableSeats)).replace('{total}', String(event.totalSeats))}</p>
              </div>
              <div>
                <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: 'var(--afa-space-1)' }}>{d.ticketPrice}</p>
                <p style={{ fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>
                  {event.isFree
                    ? d.free
                    : event.ticketPrice
                    ? formatINR(event.ticketPrice)
                    : event.ticketTiers && event.ticketTiers.length > 0
                    ? (() => {
                        const prices = event.ticketTiers.map((t) => t.price)
                        const min = Math.min(...prices)
                        const max = Math.max(...prices)
                        return min === max ? formatINR(min) : `${formatINR(min)} – ${formatINR(max)}`
                      })()
                    : '—'}
                </p>
              </div>
              {event.dresscode && (
                <div>
                  <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: 'var(--afa-space-1)' }}>{d.dressCode}</p>
                  <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)' }}>{event.dresscode}</p>
                </div>
              )}
              {event.vibe && (
                <div>
                  <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: 'var(--afa-space-1)' }}>{d.vibe}</p>
                  <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)' }}>{event.vibe}</p>
                </div>
              )}
            </div>
          </div>

          {/* Venue booking */}
          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
            <h2 style={{ fontSize: 'var(--afa-text-body)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-14px)' }}>{d.venue}</h2>
            {event.venue ? (
              <div>
                <p style={{ fontSize: 'var(--afa-text-body-lg)', fontWeight: 600, color: 'var(--afa-text-primary)' }}>{event.venue.name}</p>
                <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-10px)' }}>{event.venue.address}, {event.venue.city}</p>
                {event.venueBooking && (
                  <>
                    <span
                      style={{
                        fontSize: 'var(--afa-text-micro)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                        padding: '5px var(--afa-space-10px)', borderRadius: 'var(--afa-radius-pill)', // token-ok(spacing-literal): 5px odd value, no exact token (GEN-2609-107)
                        background: (event.venueBooking.status === 'CONFIRMED' ? STATUS_TONE.sage : event.venueBooking.status === 'CANCELLED' ? STATUS_TONE.error : STATUS_TONE.gold).bg,
                        color: (event.venueBooking.status === 'CONFIRMED' ? STATUS_TONE.sage : event.venueBooking.status === 'CANCELLED' ? STATUS_TONE.error : STATUS_TONE.gold).color,
                      }}
                    >
                      {bookingStatusLabel(event.venueBooking.status, d)}
                    </span>
                    {!!event.venueBooking.platformFeeAmount && event.venueBooking.platformFeeAmount > 0 && (
                      <div style={{ marginTop: 'var(--afa-space-3)', paddingTop: 'var(--afa-space-3)', borderTop: '1px solid var(--afa-tint-06)' }}>
                        <p data-afa-platform-fee style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.7, marginBottom: walletBalance > 0 ? 'var(--afa-space-2)' : 0 }}>
                          {d.platformFeeRemaining.replace('{amount}', formatINR(event.venueBooking.platformFeeAmount))}
                        </p>
                        {walletBalance > 0 && (
                          <Button
                            data-afa-apply-wallet
                            variant="outline-accent"
                            size="sm"
                            fullWidth={false}
                            onClick={applyWalletCredit}
                            disabled={applyingWallet}
                          >
                            {applyingWallet ? d.applying : <><Icon name="wallet" size={14} style={INLINE_ICON_STYLE} /> {d.applyWalletCredit.replace('{amount}', formatINR(walletBalance))}</>}
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>
                {d.noVenueYet} <Link href={`/dashboard/organiser/events/${event.id}/edit`} style={{ color: 'var(--afa-fill-solid)', fontWeight: 600 }}>{d.addVenueLink}</Link>
              </p>
            )}
          </div>

          {event.lineup.some((p) => p.cancelledAt) && (
            <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
              <h2 style={{ fontSize: 'var(--afa-text-body)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-14px)' }}>
                {d.cancelledPerformances}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-10px)' }}>
                {event.lineup.filter((p) => p.cancelledAt).map((p) => (
                  <div key={p.id} style={{ padding: 'var(--afa-space-14px) var(--afa-space-4)', background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--afa-space-6px)', flexWrap: 'wrap', gap: 'var(--afa-space-2)' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)' }}>
                        {p.artist.stageName || p.artist.user.displayName || p.artist.user.name}
                      </span>
                      <span style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>
                        {d.cancelledOn.replace('{date}', formatDate(p.cancelledAt as string, 'medium', locale))}
                      </span>
                    </div>
                    {p.compensationType === 'BUY_IN' && p.buyInAmount && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--afa-space-2)' }}>
                        <span data-afa-refund-status={p.buyInRefundStatus ?? ''} style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.7 }}>
                          {(p.buyInRefundStatus === 'WALLET_CREDITED' ? d.buyInKeptAsCredit : d.buyInRefunded).replace('{amount}', formatINR(p.buyInAmount))}
                        </span>
                        {p.buyInRefundStatus === 'REFUNDED' && (
                          <Button
                            data-afa-keep-wallet-credit
                            variant="outline-neutral"
                            size="sm"
                            fullWidth={false}
                            onClick={() => convertToWalletCredit(p.id)}
                            disabled={actingOn === p.id}
                          >
                            {actingOn === p.id ? d.updating : d.keepAsWalletCredit}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Applications */}
          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
            <h2 style={{ fontSize: 'var(--afa-text-body)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-1)' }}>
              {d.artistApplications} {event.applications.length > 0 && `(${event.applications.length})`}
            </h2>
            {event.applications.length > 0 && (
              <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.55, marginBottom: 'var(--afa-space-14px)' }}>
                {d.termsIntro.split('{terms}')[0]}<strong data-afa-default-compensation>{describeDefaultCompensation(event, d)}</strong>{d.termsIntro.split('{terms}')[1]}
                {event.defaultCompensationType === 'BUY_IN' && ` ${d.buyInDirectNote}`}
              </p>
            )}
            {event.applications.length === 0 ? (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>{d.noApplications}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-10px)' }}>
                {event.applications.map((app) => {
                  const shownStatus = displayApplicationStatus(app.status, event)
                  const appStyle = APPLICATION_STYLE[shownStatus] || APPLICATION_STYLE.PENDING
                  return (
                    <div key={app.id} data-afa-application={app.id} style={{ padding: 'var(--afa-space-14px) var(--afa-space-4)', background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-md)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--afa-space-6px)' }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)' }}>
                          {app.artist.stageName || app.artist.user.name}
                        </span>
                        <span data-afa-status={shownStatus} style={{ fontSize: 'var(--afa-text-micro)', fontWeight: 700, textTransform: 'uppercase', padding: 'var(--afa-space-1) var(--afa-space-10px)', borderRadius: 'var(--afa-radius-pill)', background: appStyle.bg, color: appStyle.color }}>
                          {shownStatus === 'CLOSED' ? tr.common.applicationClosed : applicationStatusLabel(app.status, tr.dashboardChrome)}
                        </span>
                      </div>
                      {app.message && <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.7, marginBottom: 'var(--afa-space-10px)' }}>{app.message}</p>}
                      {shownStatus !== 'CLOSED' && (app.status === 'PENDING' || app.status === 'WAITLISTED') && (
                        <div style={{ display: 'flex', gap: 'var(--afa-space-2)' }}>
                          <Button
                            data-afa-review="approve"
                            variant="success"
                            size="sm"
                            fullWidth={false}
                            onClick={() => reviewApplication(app.id, 'APPROVED')}
                            disabled={actingOn === app.id}
                          >
                            {d.approve}
                          </Button>
                          <Button
                            data-afa-review="reject"
                            variant="outline-error"
                            size="sm"
                            fullWidth={false}
                            onClick={() => reviewApplication(app.id, 'REJECTED')}
                            disabled={actingOn === app.id}
                          >
                            {d.reject}
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div data-afa-action-row style={{ display: 'flex', gap: 'var(--afa-space-3)', flexWrap: 'wrap' }}>
            <Link
              data-afa-edit-event
              href={`/dashboard/organiser/events/${event.id}/edit`}
              style={{ fontSize: 'var(--afa-text-body)', fontWeight: 600, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-fill-solid)', textDecoration: 'none', padding: 'var(--afa-space-3) var(--afa-space-6)', borderRadius: 'var(--afa-radius-md)' }}
            >
              {d.editEvent}
            </Link>
            <Link
              href={`/dashboard/organiser/events/${event.id}/lineup`}
              style={{ fontSize: 'var(--afa-text-body)', fontWeight: 600, color: 'var(--afa-text-primary)', background: 'transparent', border: '1px solid var(--afa-tint-20)', textDecoration: 'none', padding: 'var(--afa-space-3) var(--afa-space-6)', borderRadius: 'var(--afa-radius-md)' }}
            >
              <Icon name="music" size={16} style={INLINE_ICON_STYLE} /> {d.lineup}
            </Link>
            <Link
              href={`/dashboard/organiser/events/${event.id}/checkin`}
              style={{ fontSize: 'var(--afa-text-body)', fontWeight: 600, color: 'var(--afa-text-primary)', background: 'transparent', border: '1px solid var(--afa-tint-20)', textDecoration: 'none', padding: 'var(--afa-space-3) var(--afa-space-6)', borderRadius: 'var(--afa-radius-md)' }}
            >
              <Icon name="ticket" size={16} style={INLINE_ICON_STYLE} /> {d.checkIn}
            </Link>
            <Link
              href={`/dashboard/organiser/events/${event.id}/sales`}
              style={{ fontSize: 'var(--afa-text-body)', fontWeight: 600, color: 'var(--afa-text-primary)', background: 'transparent', border: '1px solid var(--afa-tint-20)', textDecoration: 'none', padding: 'var(--afa-space-3) var(--afa-space-6)', borderRadius: 'var(--afa-radius-md)' }}
            >
              <Icon name="trendUp" size={16} style={INLINE_ICON_STYLE} /> {d.sales}
            </Link>
            <Button
              variant="primary"
              size="lg"
              fullWidth={false}
              onClick={togglePublish}
              disabled={toggling}
              title={
                event.status === 'PENDING_APPROVAL'
                  ? d.waitingOnVenueHint
                  : undefined
              }
              // BUG-2610-023 sweep - same `background: undefined` override as
              // the artist Apply button: only Unpublish sets its own outline.
              style={{
                ...(event.status === 'APPROVED' ? { color: 'var(--afa-text-primary)', background: 'transparent', border: '1px solid var(--afa-tint-20)' } : {}),
                opacity: toggling ? 0.6 : 1,
              }}
            >
              {toggling
                ? d.updating
                : event.status === 'APPROVED'
                ? d.unpublish
                : event.status === 'PENDING_APPROVAL'
                ? d.checkApproval
                : d.publishEvent}
            </Button>
          </div>
        </div>
      </main>
      </DashboardShell>
    </>
  )
}
