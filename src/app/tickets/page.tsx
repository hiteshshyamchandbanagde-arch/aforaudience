'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'
import MessageButton from '@/components/MessageButton'
import { useLocale, type Dictionary } from '@/lib/i18n/translate'

// Companion Tagging Phase 1 (reputation epic §7) - tags where the
// logged-in user is the one being tagged, awaiting their response.
interface PendingCompanionTag {
  id: string
  taggedBy: { id: string; name: string; displayName: string | null }
  booking: { id: string; event: { id: string; title: string; date: string; startTime: string } }
}

// BUG-2608-033 - same shape as PendingCompanionTag plus venue, for the
// "you're going as a guest" ticket-like cards below. A confirmed
// companion never has a Booking of their own, so this is intentionally
// not a BookingItem - no seats/price/PDF, just enough to show they're
// going.
interface AcceptedCompanionTag {
  id: string
  taggedBy: { id: string; name: string; displayName: string | null }
  booking: {
    id: string
    event: {
      id: string
      title: string
      date: string
      startTime: string
      venue: { name: string; city: string } | null
    }
  }
}

interface BookingItem {
  id: string
  seats: Record<string, number>
  seatLabels?: string[]
  totalAmount: number
  bookingFeeAmount: number
  status: string
  expiresAt: string | null
  createdAt: string
  cancelledAt: string | null
  refundAmount: number | null
  // Session 65 (Hitesh feedback) - who's tagged on this booking + their
  // response status, same PENDING/ACCEPTED/DECLINED shape as checkout.
  companionTags: {
    id: string
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
    taggedUser: { id: string; name: string; displayName: string | null }
  }[]
  event: {
    id: string
    title: string
    date: string
    startTime: string
    venue: { name: string; city: string } | null
  }
}

// Mirrors computeRefund() in /api/bookings/[id]/route.ts - client-side
// preview only, so the confirm dialog can show the real number before
// the request fires. Server is the actual source of truth; this must
// stay in sync with it by hand since there's no shared module between
// API routes and client components in this codebase's current setup.
//
// Feedback (31 Jul, Hitesh device test) - a past event's negative
// daysBefore was silently falling into the "<7 days" bucket, so the
// confirm dialog said "No refund - less than 7 days out" for a show
// that had already happened, instead of explaining why cancellation
// isn't possible at all. Server already blocked the actual cancel
// correctly; this only fixes the preview's wording (and see isPastEvent
// below, which now hides the button entirely for this case).
function previewRefund(b: BookingItem, tr: Dictionary): { amount: number; label: string } {
  const eventStart = eventStartInstant(b)
  const daysBefore = (eventStart.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  if (daysBefore <= 0) return { amount: 0, label: tr.ticketsPage.refundEventHappened }
  if (b.totalAmount <= 0) return { amount: 0, label: tr.ticketsPage.refundFreeTicket }
  if (daysBefore >= 14) {
    const amount = Math.max(0, b.totalAmount - b.bookingFeeAmount)
    return { amount, label: tr.ticketsPage.refund14PlusTemplate.replace('{amount}', amount.toLocaleString('en-IN')) }
  }
  if (daysBefore >= 7) {
    const amount = b.totalAmount * 0.5
    return { amount, label: tr.ticketsPage.refund50PercentTemplate.replace('{amount}', amount.toLocaleString('en-IN')) }
  }
  return { amount: 0, label: tr.ticketsPage.refundLessThan7Days }
}

function eventStartInstant(b: BookingItem): Date {
  const [h, m] = b.event.startTime.split(':').map(Number)
  const eventStart = new Date(b.event.date)
  eventStart.setHours(h, m, 0, 0)
  return eventStart
}

// Same past-event check as the server's block in PATCH /api/bookings/[id]
// - used to hide the Cancel button outright rather than show it and
// reject on click.
function isPastEvent(b: BookingItem): boolean {
  return eventStartInstant(b).getTime() <= Date.now()
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: 'rgba(201,151,58,0.15)', color: 'var(--afa-gold)' },
  EXPIRED: { bg: 'rgba(14,12,10,0.08)', color: 'var(--afa-ink)' },
  CONFIRMED: { bg: 'rgba(74,103,65,0.12)', color: 'var(--afa-sage)' },
  CANCELLED: { bg: 'rgba(179,38,30,0.1)', color: 'var(--afa-error)' },
  REFUNDED: { bg: 'rgba(14,12,10,0.08)', color: 'var(--afa-ink)' },
}

// A booking's display status can differ from its DB status: an expired
// PENDING is functionally dead even though the row still says PENDING.
function effectiveStatus(b: BookingItem): string {
  if (b.status === 'PENDING' && b.expiresAt && new Date(b.expiresAt) < new Date()) {
    return 'EXPIRED'
  }
  return b.status
}

export default function MyTicketsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t: tr } = useLocale()
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [pendingTags, setPendingTags] = useState<PendingCompanionTag[]>([])
  const [acceptedTags, setAcceptedTags] = useState<AcceptedCompanionTag[]>([])
  const [respondingTag, setRespondingTag] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const load = async () => {
    try {
      const res = await fetch('/api/bookings/my')
      if (!res.ok) throw new Error(tr.ticketsPage.failedToLoadFallback)
      setBookings(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadPendingTags = async () => {
    try {
      const res = await fetch('/api/companions/mine')
      if (!res.ok) return
      const data = await res.json()
      setPendingTags(data.tags || [])
    } catch {
      // Non-critical - the rest of the page still works.
    }
  }

  // BUG-2608-033 - separate fetch (rather than folding into
  // loadPendingTags) since it's a genuinely different list with its own
  // card treatment below, not more pending-inbox items.
  const loadAcceptedTags = async () => {
    try {
      const res = await fetch('/api/companions/mine?status=ACCEPTED')
      if (!res.ok) return
      const data = await res.json()
      setAcceptedTags(data.tags || [])
    } catch {
      // Non-critical - the rest of the page still works.
    }
  }

  useEffect(() => {
    if (session?.user) {
      load()
      loadPendingTags()
      loadAcceptedTags()
    }
  }, [session])

  const respondToTag = async (tagId: string, accept: boolean) => {
    setRespondingTag(tagId)
    try {
      const res = await fetch(`/api/companions/${tagId}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept }),
      })
      if (res.ok) {
        setPendingTags((prev) => prev.filter((t) => t.id !== tagId))
        // Accepting moves it straight into the "going as a guest" list
        // below - refetch rather than guess-shape the item locally,
        // this list is small and infrequent so the extra round trip is
        // cheap.
        if (accept) loadAcceptedTags()
      }
    } finally {
      setRespondingTag(null)
    }
  }

  const cancelBooking = async (b: BookingItem) => {
    if (b.status === 'CONFIRMED') {
      if (isPastEvent(b)) {
        setError(tr.ticketsPage.eventAlreadyHappenedCancelError)
        return
      }
      const { label } = previewRefund(b, tr)
      if (!window.confirm(tr.ticketsPage.cancelConfirmDialogTemplate.replace('{label}', label))) return
    }
    setCancelling(b.id)
    setError('')
    try {
      const res = await fetch(`/api/bookings/${b.id}`, { method: 'PATCH' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || tr.ticketsPage.failedToCancelFallback)
      }
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCancelling(null)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader /></>)
  if (!session) return <SiteNav />

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-cream)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 24px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '8px' }}>
            {tr.ticketsPage.pageTitle}
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '32px' }}>
            {tr.ticketsPage.pageSubtitle}
          </p>

          {error && (
            <div style={{ padding: '14px 16px', background: 'var(--afa-error-bg)', border: '1px solid var(--afa-error-border)', borderRadius: '8px', color: 'var(--afa-error)', fontSize: '14px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {/* Companion Tagging Phase 1 (reputation epic §7) - "you've been
              tagged" inbox. Sits above the ticket list since it needs a
              response, unlike the tickets below which are just informational. */}
          {pendingTags.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '17px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '10px' }}>
                {tr.ticketsPage.youveBeenTagged}
              </h2>
              {pendingTags.map((t) => (
                <div key={t.id} style={{ background: 'var(--afa-white)', border: '1px solid rgba(200,68,26,0.25)', borderRadius: '12px', padding: '14px 16px', marginBottom: '10px' }}>
                  <p style={{ fontSize: '13.5px', margin: '0 0 10px' }}>
                    <strong>{t.taggedBy.displayName || t.taggedBy.name}</strong>{' '}
                    {tr.ticketsPage.taggedYouAsCompanionForTemplate
                      .replace('{event}', t.booking.event.title)
                      .replace('{date}', new Date(t.booking.event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => respondToTag(t.id, true)}
                      disabled={respondingTag === t.id}
                      style={{ fontSize: '12px', fontWeight: 700, color: 'white', background: 'var(--afa-terracotta)', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', opacity: respondingTag === t.id ? 0.6 : 1 }}
                    >
                      {respondingTag === t.id ? tr.ticketsPage.confirmingEllipsis : tr.ticketsPage.confirmButton}
                    </button>
                    <button
                      onClick={() => respondToTag(t.id, false)}
                      disabled={respondingTag === t.id}
                      style={{ fontSize: '12px', fontWeight: 600, color: 'var(--afa-ink)', opacity: respondingTag === t.id ? 0.4 : 0.6, background: 'transparent', border: '1px solid rgba(14,12,10,0.15)', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer' }}
                    >
                      {tr.ticketsPage.declineButton}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* BUG-2608-033 - confirmed companion tags rendered as their
              own ticket-like cards. Deliberately lighter than the real
              booking cards below (no price, no seat labels, no PDF
              download) - a companion never has a Booking of their own,
              so this shows only what's actually true: they're confirmed
              to attend as someone else's guest. */}
          {acceptedTags.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '17px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '10px' }}>
                {tr.ticketsPage.youreGoingAsGuest}
              </h2>
              {acceptedTags.map((t) => (
                <div key={t.id} style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '20px 22px', marginBottom: '14px', border: '1px solid rgba(14,12,10,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <Link href={`/events/${t.booking.event.id}`} style={{ fontSize: '16px', fontWeight: 600, color: 'var(--afa-ink)', textDecoration: 'none' }}>
                      {t.booking.event.title}
                    </Link>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', background: 'rgba(74,103,65,0.12)', color: 'var(--afa-sage)', whiteSpace: 'nowrap' }}>
                      {tr.ticketsPage.companionConfirmedPill}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, margin: '0 0 10px' }}>
                    {new Date(t.booking.event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {t.booking.event.startTime}
                    {t.booking.event.venue && <> · {t.booking.event.venue.name}, {t.booking.event.venue.city}</>}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.65, margin: 0 }}>
                    {tr.ticketsPage.guestOfTemplate.replace('{name}', t.taggedBy.displayName || t.taggedBy.name)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {bookings.length === 0 && acceptedTags.length === 0 ? (
            <div style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '40px', textAlign: 'center', border: '1px solid rgba(14,12,10,0.08)', color: 'var(--afa-ink)', opacity: 0.6 }}>
              {tr.ticketsPage.noTicketsYet} <Link href="/events" style={{ color: 'var(--afa-terracotta)', fontWeight: 600 }}>{tr.ticketsPage.browseEventsLink}</Link>
            </div>
          ) : (
            bookings.map((b) => {
              const eff = effectiveStatus(b)
              const s = STATUS_STYLE[eff] || STATUS_STYLE.PENDING
              const isLivePending = eff === 'PENDING'
              return (
                <div key={b.id} style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '20px 22px', marginBottom: '14px', border: '1px solid rgba(14,12,10,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <Link href={`/events/${b.event.id}`} style={{ fontSize: '16px', fontWeight: 600, color: 'var(--afa-ink)', textDecoration: 'none' }}>
                      {b.event.title}
                    </Link>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
                      {tr.bookingStatus[eff as keyof typeof tr.bookingStatus] || tr.bookingStatus.PENDING}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, margin: '0 0 10px' }}>
                    {new Date(b.event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {b.event.startTime}
                    {b.event.venue && <> · {b.event.venue.name}, {b.event.venue.city}</>}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--afa-ink)' }}>
                    <span>
                      {b.seatLabels && b.seatLabels.length > 0
                        ? tr.ticketsPage.seatsListTemplate.replace('{labels}', b.seatLabels.join(', '))
                        : Object.entries(b.seats).map(([section, qty]) => `${qty} × ${section}`).join(', ')}
                    </span>
                    <span style={{ fontWeight: 600 }}>{b.totalAmount > 0 ? `₹${b.totalAmount.toLocaleString('en-IN')}` : tr.eventDetailPage.freeAmount}</span>
                  </div>
                  {b.companionTags && b.companionTags.length > 0 && (
                    <p style={{ fontSize: '12.5px', color: 'var(--afa-ink)', opacity: 0.65, margin: '8px 0 0' }}>
                      {tr.ticketsPage.goingWith}{' '}
                      {b.companionTags.map((t, i) => (
                        <span key={t.id}>
                          {i > 0 && ', '}
                          {t.taggedUser.displayName || t.taggedUser.name}{' '}
                          {t.status === 'PENDING' ? tr.checkoutPage.companionPending : t.status === 'ACCEPTED' ? tr.checkoutPage.companionConfirmed : tr.checkoutPage.companionDeclined}
                        </span>
                      ))}
                    </p>
                  )}
                  {isLivePending && (
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {b.totalAmount > 0 && (
                        <Link
                          href={`/checkout/${b.id}`}
                          style={{ fontSize: '12px', fontWeight: 700, color: 'white', background: 'var(--afa-terracotta)', border: 'none', borderRadius: '6px', padding: '6px 14px', textDecoration: 'none' }}
                        >
                          {tr.ticketsPage.payNowArrow}
                        </Link>
                      )}
                      <button
                        onClick={() => cancelBooking(b)}
                        disabled={cancelling === b.id}
                        style={{ fontSize: '12px', fontWeight: 600, color: 'var(--afa-error)', background: 'transparent', border: '1px solid var(--afa-error-border)', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', opacity: cancelling === b.id ? 0.6 : 1 }}
                      >
                        {cancelling === b.id ? tr.ticketsPage.cancellingEllipsis : tr.ticketsPage.cancelButton}
                      </button>
                    </div>
                  )}
                  {eff === 'CONFIRMED' && (
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <a
                        href={`/api/bookings/${b.id}/ticket`}
                        style={{ fontSize: '12px', fontWeight: 700, color: 'white', background: 'var(--afa-ink)', border: 'none', borderRadius: '6px', padding: '6px 14px', textDecoration: 'none' }}
                      >
                        {tr.checkoutPage.downloadTicketPdf}
                      </a>
                      <MessageButton contextType="BOOKING" contextId={b.id} label={tr.ticketsPage.messageOrganiser} />
                      {!isPastEvent(b) && (
                        <button
                          onClick={() => cancelBooking(b)}
                          disabled={cancelling === b.id}
                          title={previewRefund(b, tr).label}
                          style={{ fontSize: '12px', fontWeight: 600, color: 'var(--afa-error)', background: 'transparent', border: '1px solid var(--afa-error-border)', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', opacity: cancelling === b.id ? 0.6 : 1 }}
                        >
                          {cancelling === b.id ? tr.ticketsPage.cancellingEllipsis : tr.ticketsPage.cancelTicketButton}
                        </button>
                      )}
                    </div>
                  )}
                  {(eff === 'CANCELLED' || eff === 'REFUNDED') && b.cancelledAt && (
                    <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.6, marginTop: '10px' }}>
                      {eff === 'REFUNDED'
                        ? tr.ticketsPage.refundedNoteTemplate.replace('{amount}', (b.refundAmount ?? 0).toLocaleString('en-IN'))
                        : tr.ticketsPage.cancelledNoRefund}
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      </main>
    </>
  )
}
