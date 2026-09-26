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

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT: { ...STATUS_TONE.gold, label: 'Draft' },
  APPROVED: { ...STATUS_TONE.sage, label: 'Published' },
  PENDING_APPROVAL: { ...STATUS_TONE.gold, label: 'Pending' },
  CANCELLED: { ...STATUS_TONE.error, label: 'Cancelled' },
  COMPLETED: { bg: 'var(--afa-tint-08)', color: 'var(--afa-text-primary)', label: 'Completed' },
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
}

function describeDefaultCompensation(event: EventDetail): string {
  const t = event.defaultCompensationType || 'FREE'
  if (t === 'FREE') return 'Free (no money either way)'
  if (t === 'PAID') return `Paid${event.defaultFeeAmount ? ` — ₹${event.defaultFeeAmount}` : ''}`
  return `Buy-in${event.defaultBuyInAmount ? ` — ₹${event.defaultBuyInAmount}` : ''}`
}

export default function OrganiserEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
        if (res.status === 403) throw new Error('You do not have access to this event')
        throw new Error('Event not found')
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
      if (!res.ok) throw new Error(data.error || 'Failed to apply wallet credit')
      await fetchEvent()
      showToast(`₹${data.applied.toLocaleString('en-IN')} wallet credit applied.`, 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to apply wallet credit', 'error')
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
      if (!res.ok) throw new Error('Failed to update publish status')
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
        showToast('Event unpublished.', 'success')
      } else if (updated.status === 'APPROVED') {
        showToast('Event published and live.', 'success')
      } else if (updated.status === 'PENDING_APPROVAL') {
        showToast('Submitted - waiting on the venue owner to confirm the booking.', 'success')
      } else {
        showToast('Event updated.', 'success')
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update publish status', 'error')
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
        throw new Error(data.error || 'Failed to update application')
      }
      await fetchEvent()
      showToast(newStatus === 'APPROVED' ? 'Application approved.' : 'Application rejected.', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to update application', 'error')
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
        throw new Error(data.error || 'Failed to update')
      }
      await fetchEvent()
      showToast('Kept as wallet credit instead of a refund.', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to update', 'error')
    } finally {
      setActingOn(null)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><DashboardShell><BrandLoader /></DashboardShell></>)
  if (!session) return (<><SiteNav /><DashboardShell>{null}</DashboardShell></>)
  if (error && !event) return (<><SiteNav /><DashboardShell><div style={{ padding: 'var(--afa-space-32px)', color: 'var(--afa-error-bright)' }}>{error}</div></DashboardShell></>)
  if (!event) return (<><SiteNav /><DashboardShell><div style={{ padding: 'var(--afa-space-32px)' }}>Event not found</div></DashboardShell></>)

  const statusStyle = STATUS_STYLE[event.status] || STATUS_STYLE.DRAFT

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: 'var(--afa-space-48px) var(--afa-space-6)' }}>
          <BackLink href="/dashboard/organiser" label="Back to Events" />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 'var(--afa-space-4)', marginBottom: 'var(--afa-space-28px)', gap: 'var(--afa-space-4)', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-page-title-lg)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-6px)' }}>
                {event.title}
              </h1>
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>
                {new Date(event.date).toLocaleDateString()} · {formatEventTimeRange(event.startTime, event.endTime)}
              </p>
            </div>
            <span
              style={{
                fontSize: 'var(--afa-text-small)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                padding: 'var(--afa-space-6px) var(--afa-space-14px)', borderRadius: 'var(--afa-radius-pill)', background: statusStyle.bg, color: statusStyle.color, whiteSpace: 'nowrap',
              }}
            >
              {statusStyle.label}
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
                  Share Poster
                </h3>
                <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>
                  Available once {event.venue ? 'the venue owner confirms your booking' : "you've booked a venue and it's confirmed"}.
                </p>
              </div>
            )}
          </div>

          {/* Overview */}
          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
            <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.8, marginBottom: 'var(--afa-space-5)', lineHeight: 1.6 }}>{event.description}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--afa-space-5)' }}>
              <div>
                <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: 'var(--afa-space-1)' }}>Seats</p>
                <p style={{ fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{event.availableSeats} / {event.totalSeats} available</p>
              </div>
              <div>
                <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: 'var(--afa-space-1)' }}>Ticket Price</p>
                <p style={{ fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>
                  {event.isFree
                    ? 'Free'
                    : event.ticketPrice
                    ? `₹${event.ticketPrice}`
                    : event.ticketTiers && event.ticketTiers.length > 0
                    ? (() => {
                        const prices = event.ticketTiers.map((t) => t.price)
                        const min = Math.min(...prices)
                        const max = Math.max(...prices)
                        return min === max ? `₹${min}` : `₹${min} – ₹${max}`
                      })()
                    : '—'}
                </p>
              </div>
              {event.dresscode && (
                <div>
                  <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: 'var(--afa-space-1)' }}>Dress Code</p>
                  <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)' }}>{event.dresscode}</p>
                </div>
              )}
              {event.vibe && (
                <div>
                  <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: 'var(--afa-space-1)' }}>Vibe</p>
                  <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)' }}>{event.vibe}</p>
                </div>
              )}
            </div>
          </div>

          {/* Venue booking */}
          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
            <h2 style={{ fontSize: 'var(--afa-text-body)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-14px)' }}>Venue</h2>
            {event.venue ? (
              <div>
                <p style={{ fontSize: 'var(--afa-text-body-lg)', fontWeight: 600, color: 'var(--afa-text-primary)' }}>{event.venue.name}</p>
                <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-10px)' }}>{event.venue.address}, {event.venue.city}</p>
                {event.venueBooking && (
                  <>
                    <span
                      style={{
                        fontSize: 'var(--afa-text-micro)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                        padding: '5px var(--afa-space-10px)', borderRadius: 'var(--afa-radius-pill)',
                        background: (event.venueBooking.status === 'CONFIRMED' ? STATUS_TONE.sage : event.venueBooking.status === 'CANCELLED' ? STATUS_TONE.error : STATUS_TONE.gold).bg,
                        color: (event.venueBooking.status === 'CONFIRMED' ? STATUS_TONE.sage : event.venueBooking.status === 'CANCELLED' ? STATUS_TONE.error : STATUS_TONE.gold).color,
                      }}
                    >
                      Booking {event.venueBooking.status.toLowerCase()}
                    </span>
                    {!!event.venueBooking.platformFeeAmount && event.venueBooking.platformFeeAmount > 0 && (
                      <div style={{ marginTop: 'var(--afa-space-3)', paddingTop: 'var(--afa-space-3)', borderTop: '1px solid rgba(245,245,240,0.06)' }}>
                        <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.7, marginBottom: walletBalance > 0 ? '8px' : 0 }}>
                          Platform fee remaining: ₹{event.venueBooking.platformFeeAmount.toLocaleString('en-IN')}
                        </p>
                        {walletBalance > 0 && (
                          <Button
                            variant="outline-accent"
                            size="sm"
                            fullWidth={false}
                            onClick={applyWalletCredit}
                            disabled={applyingWallet}
                          >
                            {applyingWallet ? 'Applying...' : `💰 Apply wallet credit (₹${walletBalance.toLocaleString('en-IN')} available)`}
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>
                No venue booked yet. <Link href={`/dashboard/organiser/events/${event.id}/edit`} style={{ color: 'var(--afa-fill-solid)', fontWeight: 600 }}>Add one from the edit page.</Link>
              </p>
            )}
          </div>

          {event.lineup.some((p) => p.cancelledAt) && (
            <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
              <h2 style={{ fontSize: 'var(--afa-text-body)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-14px)' }}>
                Cancelled Performances
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-10px)' }}>
                {event.lineup.filter((p) => p.cancelledAt).map((p) => (
                  <div key={p.id} style={{ padding: 'var(--afa-space-14px) var(--afa-space-4)', background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--afa-space-6px)', flexWrap: 'wrap', gap: 'var(--afa-space-2)' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)' }}>
                        {p.artist.stageName || p.artist.user.displayName || p.artist.user.name}
                      </span>
                      <span style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>
                        Cancelled {new Date(p.cancelledAt as string).toLocaleDateString()}
                      </span>
                    </div>
                    {p.compensationType === 'BUY_IN' && p.buyInAmount && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--afa-space-2)' }}>
                        <span style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.7 }}>
                          Buy-in ₹{p.buyInAmount.toLocaleString('en-IN')} - {p.buyInRefundStatus === 'WALLET_CREDITED' ? 'kept as wallet credit' : 'marked as refunded to the artist'}
                        </span>
                        {p.buyInRefundStatus === 'REFUNDED' && (
                          <Button
                            variant="outline-neutral"
                            size="sm"
                            fullWidth={false}
                            onClick={() => convertToWalletCredit(p.id)}
                            disabled={actingOn === p.id}
                          >
                            {actingOn === p.id ? 'Updating...' : 'Keep as wallet credit instead'}
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
              Artist Applications {event.applications.length > 0 && `(${event.applications.length})`}
            </h2>
            {event.applications.length > 0 && (
              <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.55, marginBottom: 'var(--afa-space-14px)' }}>
                Artists apply under this event's declared compensation terms — <strong>{describeDefaultCompensation(event)}</strong>. Approving locks this in for the artist; it's final.
                {event.defaultCompensationType === 'BUY_IN' && ' A Buy-in amount is paid directly to you by the artist - not yet processed or confirmed by the platform.'}
              </p>
            )}
            {event.applications.length === 0 ? (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>No applications yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-10px)' }}>
                {event.applications.map((app) => {
                  const appStyle = APPLICATION_STYLE[app.status] || APPLICATION_STYLE.PENDING
                  return (
                    <div key={app.id} style={{ padding: 'var(--afa-space-14px) var(--afa-space-4)', background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-md)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--afa-space-6px)' }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)' }}>
                          {app.artist.stageName || app.artist.user.name}
                        </span>
                        <span style={{ fontSize: 'var(--afa-text-micro)', fontWeight: 700, textTransform: 'uppercase', padding: 'var(--afa-space-1) var(--afa-space-10px)', borderRadius: 'var(--afa-radius-pill)', background: appStyle.bg, color: appStyle.color }}>
                          {app.status.toLowerCase()}
                        </span>
                      </div>
                      {app.message && <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.7, marginBottom: 'var(--afa-space-10px)' }}>{app.message}</p>}
                      {(app.status === 'PENDING' || app.status === 'WAITLISTED') && (
                        <div style={{ display: 'flex', gap: 'var(--afa-space-2)' }}>
                          <Button
                            variant="success"
                            size="sm"
                            fullWidth={false}
                            onClick={() => reviewApplication(app.id, 'APPROVED')}
                            disabled={actingOn === app.id}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outline-error"
                            size="sm"
                            fullWidth={false}
                            onClick={() => reviewApplication(app.id, 'REJECTED')}
                            disabled={actingOn === app.id}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 'var(--afa-space-3)', flexWrap: 'wrap' }}>
            <Link
              href={`/dashboard/organiser/events/${event.id}/edit`}
              style={{ fontSize: 'var(--afa-text-body)', fontWeight: 600, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-fill-solid)', textDecoration: 'none', padding: 'var(--afa-space-3) var(--afa-space-6)', borderRadius: 'var(--afa-radius-md)' }}
            >
              Edit Event
            </Link>
            <Link
              href={`/dashboard/organiser/events/${event.id}/lineup`}
              style={{ fontSize: 'var(--afa-text-body)', fontWeight: 600, color: 'var(--afa-text-primary)', background: 'transparent', border: '1px solid rgba(245,245,240,0.2)', textDecoration: 'none', padding: 'var(--afa-space-3) var(--afa-space-6)', borderRadius: 'var(--afa-radius-md)' }}
            >
              🎤 Lineup
            </Link>
            <Link
              href={`/dashboard/organiser/events/${event.id}/checkin`}
              style={{ fontSize: 'var(--afa-text-body)', fontWeight: 600, color: 'var(--afa-text-primary)', background: 'transparent', border: '1px solid rgba(245,245,240,0.2)', textDecoration: 'none', padding: 'var(--afa-space-3) var(--afa-space-6)', borderRadius: 'var(--afa-radius-md)' }}
            >
              🎟 Check-In
            </Link>
            <Link
              href={`/dashboard/organiser/events/${event.id}/sales`}
              style={{ fontSize: 'var(--afa-text-body)', fontWeight: 600, color: 'var(--afa-text-primary)', background: 'transparent', border: '1px solid rgba(245,245,240,0.2)', textDecoration: 'none', padding: 'var(--afa-space-3) var(--afa-space-6)', borderRadius: 'var(--afa-radius-md)' }}
            >
              📊 Sales
            </Link>
            <Button
              variant="primary"
              size="lg"
              fullWidth={false}
              onClick={togglePublish}
              disabled={toggling}
              title={
                event.status === 'PENDING_APPROVAL'
                  ? 'Waiting on the venue owner to confirm the booking - click to check again'
                  : undefined
              }
              style={{
                color: event.status === 'APPROVED' ? 'var(--afa-text-primary)' : 'var(--afa-on-fill-solid)',
                background: event.status === 'APPROVED' ? 'transparent' : undefined,
                border: event.status === 'APPROVED' ? '1px solid rgba(245,245,240,0.2)' : 'none',
                opacity: toggling ? 0.6 : 1,
              }}
            >
              {toggling
                ? 'Updating...'
                : event.status === 'APPROVED'
                ? 'Unpublish'
                : event.status === 'PENDING_APPROVAL'
                ? 'Check approval status'
                : 'Publish Event'}
            </Button>
          </div>
        </div>
      </main>
      </DashboardShell>
    </>
  )
}
