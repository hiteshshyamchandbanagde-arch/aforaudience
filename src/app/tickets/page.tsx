'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'
import MessageButton from '@/components/MessageButton'

// Companion Tagging Phase 1 (reputation epic §7) - tags where the
// logged-in user is the one being tagged, awaiting their response.
interface PendingCompanionTag {
  id: string
  taggedBy: { id: string; name: string; displayName: string | null }
  booking: { id: string; event: { id: string; title: string; date: string; startTime: string } }
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
function previewRefund(b: BookingItem): { amount: number; label: string } {
  const eventStart = eventStartInstant(b)
  const daysBefore = (eventStart.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  if (daysBefore <= 0) return { amount: 0, label: "This event has already happened" }
  if (b.totalAmount <= 0) return { amount: 0, label: 'Free ticket - nothing to refund' }
  if (daysBefore >= 14) {
    const amount = Math.max(0, b.totalAmount - b.bookingFeeAmount)
    return { amount, label: `₹${amount.toLocaleString('en-IN')} refund (14+ days out)` }
  }
  if (daysBefore >= 7) {
    const amount = b.totalAmount * 0.5
    return { amount, label: `₹${amount.toLocaleString('en-IN')} refund - 50% (7-14 days out)` }
  }
  return { amount: 0, label: 'No refund - less than 7 days out' }
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

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PENDING: { bg: 'rgba(201,151,58,0.15)', color: 'var(--afa-gold)', label: 'Reserved — pay to confirm' },
  EXPIRED: { bg: 'rgba(14,12,10,0.08)', color: 'var(--afa-ink)', label: 'Expired — book again' },
  CONFIRMED: { bg: 'rgba(74,103,65,0.12)', color: 'var(--afa-sage)', label: 'Confirmed' },
  CANCELLED: { bg: 'rgba(179,38,30,0.1)', color: 'var(--afa-error)', label: 'Cancelled' },
  REFUNDED: { bg: 'rgba(14,12,10,0.08)', color: 'var(--afa-ink)', label: 'Refunded' },
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
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [pendingTags, setPendingTags] = useState<PendingCompanionTag[]>([])
  const [respondingTag, setRespondingTag] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const load = async () => {
    try {
      const res = await fetch('/api/bookings/my')
      if (!res.ok) throw new Error('Failed to load your tickets')
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

  useEffect(() => {
    if (session?.user) {
      load()
      loadPendingTags()
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
      if (res.ok) setPendingTags((prev) => prev.filter((t) => t.id !== tagId))
    } finally {
      setRespondingTag(null)
    }
  }

  const cancelBooking = async (b: BookingItem) => {
    if (b.status === 'CONFIRMED') {
      if (isPastEvent(b)) {
        setError("This event has already happened - it can't be cancelled.")
        return
      }
      const { label } = previewRefund(b)
      if (!window.confirm(`Cancel this ticket?\n\n${label}\n\nThis can't be undone.`)) return
    }
    setCancelling(b.id)
    setError('')
    try {
      const res = await fetch(`/api/bookings/${b.id}`, { method: 'PATCH' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to cancel')
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
            My Tickets
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '32px' }}>
            Reserved bookings need to be paid to lock in your seats. Confirmed bookings are yours.
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
                You've been tagged
              </h2>
              {pendingTags.map((t) => (
                <div key={t.id} style={{ background: 'var(--afa-white)', border: '1px solid rgba(200,68,26,0.25)', borderRadius: '12px', padding: '14px 16px', marginBottom: '10px' }}>
                  <p style={{ fontSize: '13.5px', margin: '0 0 10px' }}>
                    <strong>{t.taggedBy.displayName || t.taggedBy.name}</strong> tagged you as their companion for{' '}
                    <strong>{t.booking.event.title}</strong> on{' '}
                    {new Date(t.booking.event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => respondToTag(t.id, true)}
                      disabled={respondingTag === t.id}
                      style={{ fontSize: '12px', fontWeight: 700, color: 'white', background: 'var(--afa-terracotta)', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', opacity: respondingTag === t.id ? 0.6 : 1 }}
                    >
                      {respondingTag === t.id ? 'Confirming…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => respondToTag(t.id, false)}
                      disabled={respondingTag === t.id}
                      style={{ fontSize: '12px', fontWeight: 600, color: 'var(--afa-ink)', opacity: respondingTag === t.id ? 0.4 : 0.6, background: 'transparent', border: '1px solid rgba(14,12,10,0.15)', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer' }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {bookings.length === 0 ? (
            <div style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '40px', textAlign: 'center', border: '1px solid rgba(14,12,10,0.08)', color: 'var(--afa-ink)', opacity: 0.6 }}>
              No tickets yet. <Link href="/events" style={{ color: 'var(--afa-terracotta)', fontWeight: 600 }}>Browse events</Link>
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
                      {s.label}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, margin: '0 0 10px' }}>
                    {new Date(b.event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {b.event.startTime}
                    {b.event.venue && <> · {b.event.venue.name}, {b.event.venue.city}</>}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--afa-ink)' }}>
                    <span>
                      {b.seatLabels && b.seatLabels.length > 0
                        ? `Seats ${b.seatLabels.join(', ')}`
                        : Object.entries(b.seats).map(([section, qty]) => `${qty} × ${section}`).join(', ')}
                    </span>
                    <span style={{ fontWeight: 600 }}>{b.totalAmount > 0 ? `₹${b.totalAmount.toLocaleString('en-IN')}` : 'Free'}</span>
                  </div>
                  {b.companionTags && b.companionTags.length > 0 && (
                    <p style={{ fontSize: '12.5px', color: 'var(--afa-ink)', opacity: 0.65, margin: '8px 0 0' }}>
                      Going with{' '}
                      {b.companionTags.map((t, i) => (
                        <span key={t.id}>
                          {i > 0 && ', '}
                          {t.taggedUser.displayName || t.taggedUser.name}{' '}
                          {t.status === 'PENDING' ? '(pending)' : t.status === 'ACCEPTED' ? '(confirmed)' : '(declined)'}
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
                          Pay now →
                        </Link>
                      )}
                      <button
                        onClick={() => cancelBooking(b)}
                        disabled={cancelling === b.id}
                        style={{ fontSize: '12px', fontWeight: 600, color: 'var(--afa-error)', background: 'transparent', border: '1px solid var(--afa-error-border)', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', opacity: cancelling === b.id ? 0.6 : 1 }}
                      >
                        {cancelling === b.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    </div>
                  )}
                  {eff === 'CONFIRMED' && (
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <a
                        href={`/api/bookings/${b.id}/ticket`}
                        style={{ fontSize: '12px', fontWeight: 700, color: 'white', background: 'var(--afa-ink)', border: 'none', borderRadius: '6px', padding: '6px 14px', textDecoration: 'none' }}
                      >
                        Download ticket (PDF)
                      </a>
                      <MessageButton contextType="BOOKING" contextId={b.id} label="Message Organiser" />
                      {!isPastEvent(b) && (
                        <button
                          onClick={() => cancelBooking(b)}
                          disabled={cancelling === b.id}
                          title={previewRefund(b).label}
                          style={{ fontSize: '12px', fontWeight: 600, color: 'var(--afa-error)', background: 'transparent', border: '1px solid var(--afa-error-border)', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', opacity: cancelling === b.id ? 0.6 : 1 }}
                        >
                          {cancelling === b.id ? 'Cancelling...' : 'Cancel ticket'}
                        </button>
                      )}
                    </div>
                  )}
                  {(eff === 'CANCELLED' || eff === 'REFUNDED') && b.cancelledAt && (
                    <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.6, marginTop: '10px' }}>
                      {eff === 'REFUNDED'
                        ? `₹${(b.refundAmount ?? 0).toLocaleString('en-IN')} refunded to your original payment method.`
                        : 'Cancelled - no amount was refunded.'}
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
