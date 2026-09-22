'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'
import DashboardShell from '@/components/DashboardShell'
import MessageButton from '@/components/MessageButton'
import { ErrorBanner } from '@/components/ErrorBanner'
import { EventPoster } from '@/components/EventCard'
import { CalendarIcon, PinIcon, ClockIcon, CheckIcon, BanIcon, RefundIcon, DownloadIcon, MessageIcon, TicketIcon } from '@/components/icons/EventIcons'
import { useLocale, type Dictionary } from '@/lib/i18n/translate'
import { STATUS_TONE, FILL_SOLID_BORDER_TINT } from '@/lib/statusStyle'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import StubRow from '@/components/ui/StubRow'

// Mobile Redesign Phase 4a (GEN-2609-006) - real, scannable QR rather
// than the Figma mock's decorative QrIcon glyph. Encodes the raw
// booking ID, same convention as the PDF ticket's QR (src/lib/ticket-
// pdf.ts) - "not signed, not tokenized... a check-in scanner can trust
// it as-is" per that file's own comment, so this is the exact value a
// future scanner will expect, not a lookalike placeholder that would
// fail if someone actually tried to scan a phone screen at a door.
function TicketQr({ value, size = 64 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, { margin: 0, width: size * 2 }).then((url) => {
      if (!cancelled) setDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [value, size])
  if (!dataUrl) return <div style={{ width: size, height: size, background: 'var(--afa-tint-08)', borderRadius: 'var(--afa-radius-sm)' }} />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="" width={size} height={size} style={{ display: 'block', borderRadius: 4 }} />
}

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
  // FEAT-2608-006 - already returned by /api/bookings/my (Booking is a
  // full-scalar `include`, not a `select`), just never surfaced in the
  // UI before. Used to split the Past section into attended/missed.
  checkedInAt: string | null
  // Mobile Redesign Phase 4a (GEN-2609-006) - same story as checkedInAt
  // above: /api/bookings/my's `include` already returns this scalar,
  // it just had no client-side field to land in before this restyle's
  // ticket-code caption needed it. No API or schema change.
  ticketCode: string | null
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
    // Mobile Redesign Phase 4a (GEN-2609-006) - both already present in
    // /api/bookings/my's response (event is a full-scalar `include`),
    // just newly typed/surfaced here for the restyled poster header.
    type: string
    posterImage: string | null
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

// FEAT-2608-006 - date-based sections (Today / This weekend / Upcoming /
// Past) instead of one flat list. "This weekend" means the next Sat or
// Sun within the coming 7 days - matches how people actually think about
// "this weekend" rather than a fixed Mon-Sun calendar week.
type TicketSection = 'today' | 'weekend' | 'upcoming' | 'past'

function getSection(b: BookingItem): TicketSection {
  const start = eventStartInstant(b)
  const now = new Date()
  if (start.getTime() <= now.getTime()) return 'past'
  if (start.toDateString() === now.toDateString()) return 'today'
  const diffDays = (start.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  const day = start.getDay() // 0 = Sun, 6 = Sat
  if (diffDays <= 7 && (day === 0 || day === 6)) return 'weekend'
  return 'upcoming'
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING: STATUS_TONE.gold,
  EXPIRED: STATUS_TONE.muted,
  CONFIRMED: STATUS_TONE.sage,
  CANCELLED: STATUS_TONE.error,
  REFUNDED: STATUS_TONE.muted,
}

// GEN-2609-068 - v6 redesign's status chip is icon + label, not
// color-only (task item 1). One icon per effective status, reusing
// EventIcons.tsx's new Check/Clock/Ban/Refund icons rather than the
// Figma export's own inlined glyphs.
const STATUS_ICON: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  PENDING: ClockIcon,
  EXPIRED: ClockIcon,
  CONFIRMED: CheckIcon,
  CANCELLED: BanIcon,
  REFUNDED: RefundIcon,
}

// A booking's display status can differ from its DB status: an expired
// PENDING is functionally dead even though the row still says PENDING.
function effectiveStatus(b: BookingItem): string {
  if (b.status === 'PENDING' && b.expiresAt && new Date(b.expiresAt) < new Date()) {
    return 'EXPIRED'
  }
  return b.status
}

// GEN-2609-068 - the redesigned "ticket stub" row's real-data mapping.
// Booking has no single "tier" field - `seats` is a tier/section name ->
// qty record (multi-tier bookings are real, e.g. 2 VIP + 1 General), and
// `seatLabels` is only populated for numbered-seat venues. Tier shows
// the section name(s); Qty prefers the actual seat count (seatLabels)
// when the venue is numbered, falling back to summed `seats` quantities
// otherwise; Ref is the same ticketCode already shown elsewhere on this
// page. StubRow's own `whiteSpace: nowrap` + ellipsis handles a long
// multi-tier name list without needing truncation logic here.
function stubCells(b: BookingItem, tr: Dictionary) {
  const tierNames = Object.keys(b.seats)
  const qty = b.seatLabels && b.seatLabels.length > 0 ? b.seatLabels.length : Object.values(b.seats).reduce((sum, n) => sum + n, 0)
  return [
    { label: tr.ticketsPage.stubTierLabel, value: tierNames.length > 0 ? tierNames.join(', ') : '—' },
    { label: tr.ticketsPage.stubQtyLabel, value: qty || '—', align: 'center' as const },
    { label: tr.ticketsPage.stubRefLabel, value: b.ticketCode || '—', align: 'right' as const },
  ]
}

// GEN-2609-068 - shared 10px mono/uppercase/amber section-header
// treatment (page kicker + "Today"/"This weekend"/etc.), collapsing
// what the v6 mockup drew as 3 near-duplicate micro-label sizes down to
// exactly 2 roles across this page - this is the section-level role: a
// rule line after the label, reused across all 4 real date-based
// sections (this page's actual grouping, kept as the more useful real
// logic rather than the mock's simpler confirmed/pending/past split -
// see docs/design.md's GEN-2609-068 entry).
function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-3)', marginBottom: 'var(--afa-space-3)' }}>
      <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-10px)', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--afa-amber)', whiteSpace: 'nowrap' }}>{label}</p>
      <div style={{ height: 1, flex: 1, background: 'var(--afa-tint-08)' }} />
    </div>
  )
}

// GEN-2609-068 - the CONFIRMED-only perforated divider, matching the
// v6 mockup's "torn ticket stub" visual. The punch-circles use
// --afa-surface-page (the real PAGE background) against a card that
// sits on --afa-surface-raised, the same page/card relationship the
// mockup's own #141414-on-#1F1F1F pairing relied on to read as an
// actual cutout rather than a plain dashed line.
function PerfDivider() {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <div style={{ position: 'absolute', left: -12, width: 20, height: 20, borderRadius: '50%', background: 'var(--afa-surface-page)' }} />
      <div style={{ flex: 1, borderTop: '1px dashed rgba(245,245,240,0.12)' }} />
      <div style={{ position: 'absolute', right: -12, width: 20, height: 20, borderRadius: '50%', background: 'var(--afa-surface-page)' }} />
    </div>
  )
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
  // Mobile Redesign Phase 4a (GEN-2609-006) - click-guarded card
  // navigation, same pattern as EventCard/events/page.tsx's
  // navigatingId + useTransition (see that file's comment: without the
  // guard, a slow first render reads as "nothing happened" and repeat
  // clicks fire duplicate navigations).
  const [, startTransition] = useTransition()
  const [navigatingId, setNavigatingId] = useState<string | null>(null)
  const goToEvent = (id: string) => {
    if (navigatingId) return
    setNavigatingId(id)
    startTransition(() => {
      router.push(`/events/${id}`)
    })
  }

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
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-page)', fontFamily: 'var(--font-sans)' }}>
        <style>{`
          .afa-tickets-grid { display: grid; grid-template-columns: 1fr; gap: var(--afa-space-4); }
          @media (min-width: 640px) { .afa-tickets-grid { grid-template-columns: 1fr 1fr; } }
        `}</style>
        <div style={{ maxWidth: '800px', padding: 'var(--afa-space-48px) var(--afa-space-6)' }}>
          <p style={{ margin: '0 0 var(--afa-space-6px)', fontFamily: 'var(--font-mono)', fontSize: 'var(--afa-text-10px)', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--afa-amber)' }}>
            {tr.ticketsPage.pageKicker}
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-page-title-lg)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-2)' }}>
            {tr.ticketsPage.pageTitle}
          </h1>
          <p style={{ fontSize: 'var(--afa-text-15px)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-32px)' }}>
            {tr.ticketsPage.pageSubtitle}
          </p>

          {error && (
            <ErrorBanner style={{ marginBottom: 'var(--afa-space-5)' }}>{error}</ErrorBanner>
          )}

          {/* Companion Tagging Phase 1 (reputation epic §7) - "you've been
              tagged" inbox. Sits above the ticket list since it needs a
              response, unlike the tickets below which are just informational. */}
          {pendingTags.length > 0 && (
            <div style={{ marginBottom: 'var(--afa-space-6)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-10px)' }}>
                {tr.ticketsPage.youveBeenTagged}
              </h2>
              {pendingTags.map((t) => (
                <div key={t.id} style={{ background: 'var(--afa-surface-raised)', border: `1px solid ${FILL_SOLID_BORDER_TINT}`, borderRadius: 'var(--afa-radius-12px)', padding: 'var(--afa-space-14px) var(--afa-space-4)', marginBottom: 'var(--afa-space-10px)' }}>
                  <p style={{ fontSize: '13.5px', margin: '0 0 var(--afa-space-10px)' }}>
                    <strong>{t.taggedBy.displayName || t.taggedBy.name}</strong>{' '}
                    {tr.ticketsPage.taggedYouAsCompanionForTemplate
                      .replace('{event}', t.booking.event.title)
                      .replace('{date}', new Date(t.booking.event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))}
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--afa-space-2)' }}>
                    <button
                      onClick={() => respondToTag(t.id, true)}
                      disabled={respondingTag === t.id}
                      style={{ fontSize: 'var(--afa-text-small)', fontWeight: 700, color: 'var(--afa-amber)', background: 'transparent', border: '1px solid rgba(201,151,58,0.4)', borderRadius: 'var(--afa-radius-sm)', padding: 'var(--afa-space-6px) var(--afa-space-14px)', cursor: 'pointer', opacity: respondingTag === t.id ? 0.6 : 1 }}
                    >
                      {respondingTag === t.id ? tr.ticketsPage.confirmingEllipsis : tr.ticketsPage.confirmButton}
                    </button>
                    <button
                      onClick={() => respondToTag(t.id, false)}
                      disabled={respondingTag === t.id}
                      style={{ fontSize: 'var(--afa-text-small)', fontWeight: 600, color: 'var(--afa-text-primary)', opacity: respondingTag === t.id ? 0.4 : 0.6, background: 'transparent', border: '1px solid var(--afa-border-resting)', borderRadius: 'var(--afa-radius-sm)', padding: 'var(--afa-space-6px) var(--afa-space-14px)', cursor: 'pointer' }}
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
            <div style={{ marginBottom: 'var(--afa-space-6)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-10px)' }}>
                {tr.ticketsPage.youreGoingAsGuest}
              </h2>
              {acceptedTags.map((t) => (
                <div key={t.id} style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-12px)', padding: 'var(--afa-space-5) 22px', marginBottom: 'var(--afa-space-14px)', border: '1px solid var(--afa-tint-08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--afa-space-2)' }}>
                    <Link href={`/events/${t.booking.event.id}`} style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-title)', fontWeight: 600, color: 'var(--afa-text-primary)', textDecoration: 'none' }}>
                      {t.booking.event.title}
                    </Link>
                    <Badge variant="status-compact" tone={STATUS_TONE.sage}>
                      {tr.ticketsPage.companionConfirmedPill}
                    </Badge>
                  </div>
                  <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6, margin: '0 0 var(--afa-space-10px)' }}>
                    {new Date(t.booking.event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {t.booking.event.startTime}
                    {t.booking.event.venue && <> · {t.booking.event.venue.name}, {t.booking.event.venue.city}</>}
                  </p>
                  <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.65, margin: 0 }}>
                    {tr.ticketsPage.guestOfTemplate.replace('{name}', t.taggedBy.displayName || t.taggedBy.name)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {bookings.length === 0 && acceptedTags.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--afa-space-4)', padding: '64px var(--afa-space-32px)', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 16, border: '1px solid var(--afa-tint-08)', background: 'var(--afa-surface-raised)' }}>
                <TicketIcon style={{ width: 28, height: 28, color: 'var(--afa-text-muted)' }} />
              </div>
              <div>
                <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-20px)', color: 'var(--afa-text-primary)', opacity: 0.85 }}>{tr.ticketsPage.emptyTitle}</p>
                <p style={{ margin: 'var(--afa-space-6px) 0 0', fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>{tr.ticketsPage.emptyDescription}</p>
                <Link href="/events" style={{ display: 'inline-block', marginTop: 'var(--afa-space-14px)', fontSize: 'var(--afa-text-ui)', color: 'var(--afa-amber)', fontWeight: 600 }}>
                  {tr.ticketsPage.browseEventsLink}
                </Link>
              </div>
            </div>
          ) : (
            (['today', 'weekend', 'upcoming', 'past'] as TicketSection[]).map((section) => {
              const items = bookings.filter((b) => getSection(b) === section)
              if (items.length === 0) return null
              const heading = {
                today: tr.ticketsPage.sectionToday,
                weekend: tr.ticketsPage.sectionThisWeekend,
                upcoming: tr.ticketsPage.sectionUpcoming,
                past: tr.ticketsPage.sectionPast,
              }[section]
              return (
                <div key={section} style={{ marginBottom: 'var(--afa-space-28px)' }}>
                  <SectionLabel label={heading} />
                  <div className="afa-tickets-grid">
                    {items.map((b) => renderCard(b))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </main>
      </DashboardShell>
    </>
  )

  // Extracted so the four date-sections above can share one card
  // renderer instead of duplicating this JSX per bucket.
  function renderCard(b: BookingItem) {
              const eff = effectiveStatus(b)
              const s = STATUS_STYLE[eff] || STATUS_STYLE.PENDING
              const StatusIcon = STATUS_ICON[eff] || ClockIcon
              const isLivePending = eff === 'PENDING'
              const showAttendancePill = eff === 'CONFIRMED' && isPastEvent(b)
              // GEN-2609-068 - v6 redesign: cancelled/refunded cards are
              // ghosted (55% opacity) and non-interactive, matching the
              // v6 mockup exactly - a deliberate decision, not a silent
              // copy. Flagged in docs/design.md/HANDOFF.md as worth
              // Hitesh's explicit confirmation: the event itself already
              // happened or the booking is dead either way, so there's
              // an argument a still-tappable card (to see the past event
              // page / who else went) is more useful than a fully inert
              // one. Kept matching the mockup for this pass since it's
              // the simpler, lower-risk default - easy to reverse if
              // that confirmation comes back the other way.
              const isGhosted = eff === 'CANCELLED' || eff === 'REFUNDED'
              const typeKey = (b.event.type in tr.eventTypes ? b.event.type : 'OPEN_MIC') as keyof typeof tr.eventTypes
              const typeLabel = tr.eventTypes[typeKey]
              const isNavigating = navigatingId === b.event.id
              // The QR only makes sense once a booking is actually
              // CONFIRMED (matches the existing "Download ticket PDF"
              // button's own gating below) - a PENDING/CANCELLED/
              // REFUNDED booking has nothing to scan at a door.
              const showQr = eff === 'CONFIRMED'
              const used = showQr && !!b.checkedInAt
              return (
                <div
                  key={b.id}
                  role={isGhosted ? undefined : 'link'}
                  tabIndex={isGhosted ? undefined : 0}
                  aria-busy={isNavigating}
                  onClick={isGhosted ? undefined : () => goToEvent(b.event.id)}
                  onKeyDown={
                    isGhosted
                      ? undefined
                      : (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            goToEvent(b.event.id)
                          }
                        }
                  }
                  className={isGhosted ? undefined : 'afa-focusable'}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'var(--afa-surface-raised)',
                    borderRadius: '16px',
                    border: isGhosted ? '1px solid rgba(245,245,240,0.06)' : '1px solid rgba(245,245,240,0.1)',
                    cursor: isGhosted ? 'default' : navigatingId && !isNavigating ? 'default' : 'pointer',
                    opacity: (isGhosted ? 0.55 : 1) * (navigatingId && !isNavigating ? 0.5 : 1) * (used ? 0.85 : 1),
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  {isNavigating && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'rgba(10,10,10,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '50%', border: '3px solid var(--afa-border-resting)', borderTopColor: 'var(--afa-amber)', animation: 'afa-spin 0.7s linear infinite' }} />
                    </div>
                  )}

                  {/* Hero: 112px (down from 132px), bottom-up gradient,
                      category + title over the image, status chip
                      top-right. EventPoster already builds on Photo.tsx
                      (grayscale+amber-duotone real photos) with an
                      illustrated fallback for a missing/broken
                      posterImage - kept as-is rather than calling
                      Photo.tsx directly and losing that fallback. */}
                  <div style={{ position: 'relative', height: '112px', overflow: 'hidden' }}>
                    <EventPoster posterImage={b.event.posterImage} title={b.event.title} type={b.event.type} typeLabel={typeLabel} hideCaption />
                    <div
                      style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(180deg, rgba(10,10,10,0) 35%, rgba(10,10,10,0.88) 100%)',
                      }}
                    />
                    <div style={{ position: 'absolute', right: 10, top: 10 }}>
                      <span style={{ display: 'flex', gap: 'var(--afa-space-6px)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Badge
                          variant="status-compact"
                          tone={s}
                          icon={<StatusIcon style={{ width: 11, height: 11 }} />}
                          style={{ whiteSpace: 'normal', textAlign: 'right', maxWidth: '150px' }}
                        >
                          {tr.bookingStatus[eff as keyof typeof tr.bookingStatus] || tr.bookingStatus.PENDING}
                        </Badge>
                        {showAttendancePill && (
                          <Badge variant="status-compact" tone={b.checkedInAt ? STATUS_TONE.sage : STATUS_TONE.muted}>
                            {b.checkedInAt ? tr.ticketsPage.attendedPill : tr.ticketsPage.missedPill}
                          </Badge>
                        )}
                      </span>
                    </div>
                    <div style={{ position: 'absolute', left: 14, right: 14, bottom: 10 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--afa-amber)' }}>
                        {typeLabel}
                      </div>
                      <h3
                        style={{
                          marginTop: 'var(--afa-space-2px)', fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, lineHeight: 1.25, color: 'var(--afa-text-primary)',
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}
                      >
                        {b.event.title}
                      </h3>
                    </div>
                  </div>

                  {/* Meta row: date/time + venue, font-sans 12px. */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 'var(--afa-space-4)', rowGap: 'var(--afa-space-1)', padding: 'var(--afa-space-10px) var(--afa-space-14px) 0' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-6px)', fontFamily: 'var(--font-sans)', fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-secondary)' }}>
                      <CalendarIcon style={{ width: 12, height: 12, color: 'var(--afa-text-muted)', flexShrink: 0 }} />
                      {new Date(b.event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {b.event.startTime}
                    </span>
                    {b.event.venue && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-6px)', fontFamily: 'var(--font-sans)', fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-secondary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <PinIcon style={{ width: 12, height: 12, color: 'var(--afa-text-muted)', flexShrink: 0 }} />
                        {b.event.venue.name}, {b.event.venue.city}
                      </span>
                    )}
                  </div>

                  {/* Ticket stub row (Tier / Qty / Ref) - new shared
                      StubRow component (src/components/ui/StubRow.tsx),
                      inset on --afa-surface-inverse. */}
                  <div style={{ margin: 'var(--afa-space-10px) var(--afa-space-14px) 0' }}>
                    <StubRow cells={stubCells(b, tr)} />
                  </div>

                  <div onClick={(e) => e.stopPropagation()}>
                    {/* CONFIRMED: perforated divider, QR inline with
                        price, 3-button equal-weight outline row. */}
                    {eff === 'CONFIRMED' && (
                      <>
                        <div style={{ padding: 'var(--afa-space-14px) var(--afa-space-14px) 0' }}>
                          <PerfDivider />
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--afa-space-14px)', padding: 'var(--afa-space-3) var(--afa-space-14px) var(--afa-space-14px)', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--afa-space-6px)', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 'var(--afa-radius-12px)', background: 'var(--afa-cream)' }}>
                              <TicketQr value={b.id} size={60} />
                            </div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--afa-text-muted)', textAlign: 'center' }}>
                              {used ? tr.ticketsPage.scannedLabel : tr.ticketsPage.scanAtDoor}
                            </span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {b.totalAmount > 0 && (
                              <div style={{ marginBottom: 'var(--afa-space-2)' }}>
                                <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--afa-text-muted)' }}>{tr.ticketsPage.paidLabel}</p>
                                <p style={{ margin: 'var(--afa-space-2px) 0 0', fontFamily: 'var(--font-sans)', fontSize: 'var(--afa-text-15px)', fontWeight: 600, color: 'var(--afa-text-primary)' }}>₹{b.totalAmount.toLocaleString('en-IN')}</p>
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 'var(--afa-space-2)', flexWrap: 'wrap' }}>
                              {/* GEN-2609-069 - flex: '1 1 auto' let each button claim
                                  its own natural content width first, so in the 2-up
                                  desktop grid (narrower per-card than the mobile-first
                                  reference design assumed) all 3 overflowed and each
                                  wrapped onto its own full-width line instead of
                                  sharing the row. flex-basis 0 makes them split the
                                  row equally and wrap their own label text instead. */}
                              <Button
                                variant="outline-neutral"
                                size="sm"
                                href={`/api/bookings/${b.id}/ticket`}
                                style={{ flex: '1 1 0', minWidth: 0 }}
                              >
                                <DownloadIcon style={{ width: 13, height: 13 }} />
                                {tr.checkoutPage.downloadTicketPdf}
                              </Button>
                              <MessageButton
                                contextType="BOOKING"
                                contextId={b.id}
                                label={tr.ticketsPage.messageOrganiser}
                                icon={<MessageIcon style={{ width: 13, height: 13 }} />}
                                style={{
                                  flex: '1 1 0',
                                  minWidth: 0,
                                  padding: 'var(--afa-space-1) var(--afa-space-10px)',
                                  borderRadius: 'var(--afa-radius-sm)',
                                  fontSize: 'var(--afa-text-small)',
                                  fontWeight: 600,
                                  border: '1px solid var(--afa-border-resting)',
                                  color: 'var(--afa-text-secondary)',
                                  fontFamily: 'var(--font-sans)',
                                }}
                              />
                              {!isPastEvent(b) && (
                                <Button
                                  variant="outline-neutral"
                                  size="sm"
                                  onClick={() => cancelBooking(b)}
                                  disabled={cancelling === b.id}
                                  title={previewRefund(b, tr).label}
                                  style={{ flex: '1 1 0', minWidth: 0, opacity: cancelling === b.id ? 0.6 : 1 }}
                                >
                                  {cancelling === b.id ? tr.ticketsPage.cancellingEllipsis : tr.ticketsPage.cancelTicketButton}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* PENDING: single fill-solid Pay Now + outline
                        Cancel - matches current behavior, restyled. */}
                    {isLivePending && (
                      <div style={{ display: 'flex', gap: 'var(--afa-space-2)', padding: 'var(--afa-space-3) var(--afa-space-14px) var(--afa-space-14px)' }}>
                        {b.totalAmount > 0 && (
                          <Button variant="primary" size="sm" href={`/checkout/${b.id}`} style={{ flex: 1 }}>
                            {tr.ticketsPage.payNowArrow}
                          </Button>
                        )}
                        <Button
                          variant="outline-neutral"
                          size="sm"
                          onClick={() => cancelBooking(b)}
                          disabled={cancelling === b.id}
                          style={{ flex: b.totalAmount > 0 ? 1 : undefined, opacity: cancelling === b.id ? 0.6 : 1 }}
                        >
                          {cancelling === b.id ? tr.ticketsPage.cancellingEllipsis : tr.ticketsPage.cancelButton}
                        </Button>
                      </div>
                    )}

                    {/* CANCELLED / REFUNDED: status note only, no
                        actions - card itself is ghosted/non-interactive
                        above. */}
                    {isGhosted && b.cancelledAt && (
                      <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.55, padding: '0 var(--afa-space-14px) var(--afa-space-14px)' }}>
                        {eff === 'REFUNDED'
                          ? tr.ticketsPage.refundedNoteTemplate.replace('{amount}', (b.refundAmount ?? 0).toLocaleString('en-IN'))
                          : tr.ticketsPage.cancelledNoRefund}
                      </p>
                    )}

                    {b.companionTags && b.companionTags.length > 0 && (
                      <p style={{ fontSize: '12.5px', color: 'var(--afa-text-primary)', opacity: 0.65, margin: 0, padding: isGhosted ? '0 14px 14px' : '0 14px 14px' }}>
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
                  </div>
                </div>
              )
  }
}
