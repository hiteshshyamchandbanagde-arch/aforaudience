'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import { formatEventTimeRange } from '@/lib/eventTime'
import { formatDisplayMoney, type DisplayCurrency } from '@/lib/money-display'
import { useLocale } from '@/lib/i18n/translate'
import {
  loadRazorpayCheckoutScript,
  openRazorpayCheckout,
} from '@/lib/razorpay-checkout'

// Checkout page — order summary + Pay button.
//
// Flow when this page loads:
//   1. Fetch booking + payment from GET /api/bookings/[id].
//   2. If booking is CONFIRMED already, show "you're in" state.
//   3. If PENDING and not expired and payment is CREATED, show summary
//      + Pay button. Load Razorpay script in background.
//   4. If expired, show "reservation expired" state — user should
//      book again.
//   5. If no payment attached (i.e. Razorpay wasn't configured when the
//      booking was created — e.g. on prod today), show "payment not
//      available" state.
//
// On Pay click:
//   a. Open Razorpay Checkout modal.
//   b. On success callback, POST to /api/bookings/[id]/confirm with
//      the signed values.
//   c. On confirm success, transition to "confirmed" state on-page.
//   d. On modal dismiss (user closed without paying), stay on page,
//      let them try again.

type BookingState = {
  booking: {
    id: string
    status: string
    seats: Record<string, number>
    numberedSeats: { tierLabel: string; level: string; row: string; number: string; price: number | null }[]
    totalAmount: number
    subtotalAmount: number
    bookingFeeAmount: number
    expiresAt: string | null
    isExpired: boolean
    createdAt: string
    event: {
      id: string
      title: string
      date: string
      startTime: string
      endTime: string
      venue: { name: string; city: string } | null
    }
  }
  payment: {
    razorpayOrderId: string
    amount: number
    currency: string
    status: string
    keyId: string | null
  } | null
}

// Companion Tagging Phase 1 (reputation epic §7) types.
type CompanionUser = { id: string; name: string; displayName: string | null; avatar: string | null }
type CompanionTag = { id: string; status: 'PENDING' | 'ACCEPTED' | 'DECLINED'; taggedUser: CompanionUser }

export default function CheckoutPage() {
  const params = useParams<{ bookingId: string }>()
  const bookingId = params?.bookingId
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()
  const { t: tr } = useLocale()

  const [state, setState] = useState<BookingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [scriptReady, setScriptReady] = useState(false)

  // Companion Tagging Phase 1 - separate from the payment state above
  // since tagging never blocks or is blocked by the payment flow.
  const [companionConsent, setCompanionConsent] = useState(false)
  const [companionTags, setCompanionTags] = useState<CompanionTag[]>([])
  // Feedback cmsaodzsy: cap tags to actual seats on this booking (server
  // is the real enforcement in the API route - this just gives clear
  // in-line UX instead of letting someone search, pick, and then hit an
  // error). Null until the GET response arrives.
  const [companionMax, setCompanionMax] = useState<number | null>(null)
  const [companionQuery, setCompanionQuery] = useState('')
  const [companionResults, setCompanionResults] = useState<CompanionUser[]>([])
  const [companionSearching, setCompanionSearching] = useState(false)
  const [companionBusy, setCompanionBusy] = useState(false)
  const [companionError, setCompanionError] = useState('')

  // Display-only currency preference (Option A). Loaded once, alongside
  // the booking - real charge/settlement is always INR regardless of
  // this; it only changes how the totals below are *shown*. Falls back
  // to plain ₹ formatting (via formatDisplayMoney's null-currency path)
  // if either fetch fails, so checkout never breaks over a cosmetic
  // feature.
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency | null>(null)

  // Redirect to login if not authenticated. Booking is per-user so an
  // anonymous user can't do anything useful on this page.
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push(`/login?next=/checkout/${bookingId}`)
    }
  }, [authStatus, router, bookingId])

  // Load booking + payment.
  useEffect(() => {
    if (!bookingId || authStatus !== 'authenticated') return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/bookings/${bookingId}`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(data.error || tr.checkoutPage.failedToLoadBookingFallback)
        setState(data)
        if (data.booking.status === 'CONFIRMED') setConfirmed(true)
      } catch (err: any) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bookingId, authStatus])

  // Preload the Razorpay script as soon as we know we'll need it.
  // If it fails, we'll show an error at Pay-click time; loading it early
  // just cuts the perceived wait.
  useEffect(() => {
    if (!state?.payment || confirmed) return
    loadRazorpayCheckoutScript()
      .then(() => setScriptReady(true))
      .catch(() => setScriptReady(false))
  }, [state, confirmed])

  // Load the user's display-currency preference + its live rate, once
  // authenticated. Independent of the booking fetch above - a failure
  // here just leaves displayCurrency null, which formatDisplayMoney
  // treats as "show plain ₹", so this can never block or break checkout.
  useEffect(() => {
    if (authStatus !== 'authenticated') return
    let cancelled = false
    ;(async () => {
      try {
        const [meRes, ratesRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/display-currencies'),
        ])
        if (cancelled || !meRes.ok || !ratesRes.ok) return
        const me = await meRes.json()
        const rates = await ratesRes.json()
        const code = me.user?.displayCurrency
        if (!code) return // null = India/₹ default, nothing to convert
        const match = (rates.currencies ?? []).find((c: DisplayCurrency) => c.code === code)
        if (match) setDisplayCurrency(match)
      } catch {
        // Cosmetic feature only - silently fall back to plain ₹.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authStatus])

  // Load existing companion tags/consent once the booking is known.
  // Independent of payment state - tagging is available on PENDING
  // bookings too, same as the rest of this page's summary.
  useEffect(() => {
    if (!bookingId || authStatus !== 'authenticated') return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/bookings/${bookingId}/companions`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        setCompanionConsent(!!data.companionTaggingConsent)
        setCompanionTags(data.tags || [])
        setCompanionMax(typeof data.maxCompanions === 'number' ? data.maxCompanions : null)
      } catch {
        // Non-critical - checkout still works without this section.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bookingId, authStatus])

  // Debounced companion search - 2 char minimum matches the API's floor.
  useEffect(() => {
    if (companionQuery.trim().length < 2) {
      setCompanionResults([])
      return
    }
    let cancelled = false
    setCompanionSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(companionQuery.trim())}`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        setCompanionResults(data.users || [])
      } catch {
        if (!cancelled) setCompanionResults([])
      } finally {
        if (!cancelled) setCompanionSearching(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [companionQuery])

  const toggleCompanionConsent = async (checked: boolean) => {
    if (!bookingId) return
    setCompanionError('')
    setCompanionConsent(checked) // optimistic
    try {
      const res = await fetch(`/api/bookings/${bookingId}/companions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: checked }),
      })
      if (!res.ok) throw new Error('Failed to update')
    } catch {
      setCompanionConsent(!checked) // revert
      setCompanionError(tr.checkoutPage.couldNotSaveRetry)
    }
  }

  const addCompanion = async (u: CompanionUser) => {
    if (!bookingId) return
    setCompanionBusy(true)
    setCompanionError('')
    try {
      const res = await fetch(`/api/bookings/${bookingId}/companions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addUserIds: [u.id] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || tr.checkoutPage.failedToTagFallback)
      setCompanionTags(data.tags || [])
      if (typeof data.maxCompanions === 'number') setCompanionMax(data.maxCompanions)
      setCompanionQuery('')
      setCompanionResults([])
    } catch (err: any) {
      setCompanionError(err.message || tr.checkoutPage.couldNotTagPerson)
    } finally {
      setCompanionBusy(false)
    }
  }

  const removeCompanion = async (tagId: string) => {
    if (!bookingId) return
    setCompanionBusy(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/companions?tagId=${tagId}`, { method: 'DELETE' })
      if (res.ok) setCompanionTags((prev) => prev.filter((t) => t.id !== tagId))
    } finally {
      setCompanionBusy(false)
    }
  }

  const handlePay = async () => {
    if (!state?.payment || !state.payment.keyId) return
    setPaying(true)
    setError('')

    try {
      // Ensure script is loaded (in case preload hadn't finished).
      if (!scriptReady) {
        await loadRazorpayCheckoutScript()
        setScriptReady(true)
      }

      const success = await openRazorpayCheckout({
        keyId: state.payment.keyId,
        orderId: state.payment.razorpayOrderId,
        amount: state.payment.amount,
        currency: state.payment.currency,
        bookingId: state.booking.id,
        eventTitle: state.booking.event.title,
        prefill: {
          name: (session?.user as any)?.name,
          email: (session?.user as any)?.email,
          contact: (session?.user as any)?.phone,
        },
      })

      // Paid. Now verify server-side and mark booking CONFIRMED.
      setConfirming(true)
      const confirmRes = await fetch(
        `/api/bookings/${state.booking.id}/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(success),
        }
      )
      const confirmData = await confirmRes.json()
      if (!confirmRes.ok) {
        throw new Error(confirmData.error || tr.checkoutPage.paymentConfirmationFailedFallback)
      }
      setConfirmed(true)
    } catch (err: any) {
      if (err?.code === 'DISMISSED') {
        // User just closed the modal. Don't treat as an error — let
        // them try again.
        return
      }
      setError(err?.message || tr.checkoutPage.paymentFailedFallback)
    } finally {
      setPaying(false)
      setConfirming(false)
    }
  }

  if (authStatus === 'loading' || loading) {
    return (
      <>
        <SiteNav />
        <div style={{ padding: 32, fontFamily: 'system-ui', color: 'var(--afa-text-primary)' }}>
          {tr.checkoutPage.loadingCheckout}
        </div>
      </>
    )
  }

  if (!state) {
    return (
      <>
        <SiteNav />
        <div style={{ padding: 32, fontFamily: 'system-ui', maxWidth: 640, margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, marginBottom: 16 }}>
            {tr.checkoutPage.somethingWrongTitle}
          </h1>
          <p style={{ color: 'var(--afa-error)', marginBottom: 24 }}>{error || tr.checkoutPage.bookingNotFoundFallback}</p>
          <Link href="/events" style={{ color: 'var(--afa-terracotta)', fontWeight: 600 }}>
            {tr.nav.backToEvents}
          </Link>
        </div>
      </>
    )
  }

  // Seat display, GA or Numbered. GA bookings keep using `booking.seats`
  // ({ sectionName: qty }) exactly as before - untouched. Numbered bookings
  // store `seats: {}` by design (real picks live in `numberedSeats` instead,
  // see GET /api/bookings/[id]) - group those by tier for display.
  const gaSeatEntries = Object.entries(state.booking.seats).filter(
    ([, q]) => Number(q) > 0
  ) as [string, number][]
  const numberedGroups: { tierLabel: string; level: string; count: number; price: number | null; seatLabels: string[] }[] = Object.values(
    state.booking.numberedSeats.reduce(
      (
        acc: Record<string, { tierLabel: string; level: string; count: number; price: number | null; seatLabels: string[] }>,
        s: { tierLabel: string; level: string; row: string; number: string; price: number | null }
      ) => {
        // Group by (level, tierLabel), not tierLabel alone - a same-named
        // zone on two different levels (as in this booking) can have two
        // different real prices. Grouping by name only previously merged
        // them into one line using whichever seat's price happened to be
        // first, which both mis-priced the line AND meant the line items
        // didn't even sum to the page's own Total - found live (28 Jul)
        // testing a multi-level venue with same-named, differently-priced
        // zones. Backend now returns the correct per-seat price (see
        // GET /api/bookings/[id]), so this only needs to stop merging.
        const key = `${s.level || ''}::${s.tierLabel}`
        if (!acc[key]) {
          acc[key] = { tierLabel: s.tierLabel, level: s.level, count: 0, price: s.price, seatLabels: [] }
        }
        acc[key].count += 1
        acc[key].seatLabels.push(`${s.row}${s.number}`)
        return acc
      },
      {} as Record<string, { tierLabel: string; level: string; count: number; price: number | null; seatLabels: string[] }>
    )
  )
  const seatsSummaryText =
    numberedGroups.length > 0
      ? numberedGroups.map((g) => `${g.tierLabel}${g.level ? ` (${g.level})` : ''} (${g.seatLabels.join(', ')})`).join(', ')
      : gaSeatEntries.map(([s, q]) => `${s} × ${q}`).join(', ')

  // --- Confirmed state
  if (confirmed) {
    return (
      <>
        <SiteNav />
        <main
          style={{
            padding: '48px 24px',
            maxWidth: 560,
            margin: '0 auto',
            fontFamily: 'system-ui, sans-serif',
            color: 'var(--afa-text-primary)',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎉</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 900, marginBottom: 12 }}>
            {tr.checkoutPage.youreIn}
          </h1>
          <p style={{ opacity: 0.7, lineHeight: 1.6, marginBottom: 24 }}>
            {tr.checkoutPage.bookingConfirmedPrefix} <strong>{state.booking.event.title}</strong> {tr.checkoutPage.bookingConfirmedSuffix}
            {state.booking.event.venue && (
              <>
                {' '}
                {tr.checkoutPage.seeYouAtTemplate
                  .replace('{venue}', state.booking.event.venue.name)
                  .replace('{city}', state.booking.event.venue.city)}
              </>
            )}
          </p>
          <div
            style={{
              background: 'var(--afa-surface-raised)',
              border: '1px solid rgba(14,12,10,0.08)',
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 6 }}>{tr.checkoutPage.bookingIdLabel}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 14, marginBottom: 12 }}>
              {state.booking.id}
            </div>
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 6 }}>{tr.eventDetailPage.seatsLabel}</div>
            <div style={{ fontSize: 14, marginBottom: 12 }}>
              {seatsSummaryText}
            </div>
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 6 }}>{tr.checkoutPage.amountPaidLabel}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {state.booking.totalAmount > 0 ? formatDisplayMoney(state.booking.totalAmount, displayCurrency) : tr.eventDetailPage.freeAmount}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a
              href={`/api/bookings/${state.booking.id}/ticket`}
              style={{
                background: 'var(--afa-fill-solid)',
                color: 'white',
                padding: '12px 20px',
                borderRadius: 10,
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              {tr.checkoutPage.downloadTicketPdf}
            </a>
            <Link
              href="/tickets"
              style={{
                background: 'var(--afa-terracotta)',
                color: 'white',
                padding: '12px 20px',
                borderRadius: 10,
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              {tr.checkoutPage.viewMyTicketsArrow}
            </Link>
            <Link
              href="/events"
              style={{
                color: 'var(--afa-text-primary)',
                padding: '12px 20px',
                borderRadius: 10,
                fontWeight: 600,
                textDecoration: 'none',
                border: '1px solid rgba(14,12,10,0.15)',
                display: 'inline-block',
              }}
            >
              {tr.checkoutPage.browseMoreEvents}
            </Link>
          </div>
          <p style={{ fontSize: 12, color: 'var(--afa-taupe)', marginTop: 16, lineHeight: 1.6 }}>
            {tr.checkoutPage.emailedTicketNote}
          </p>
        </main>
      </>
    )
  }

  // --- Booking already CANCELLED (e.g. user cancelled from tickets page)
  if (state.booking.status === 'CANCELLED') {
    return (
      <>
        <SiteNav />
        <main style={{ padding: '48px 24px', maxWidth: 560, margin: '0 auto', fontFamily: 'system-ui' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, marginBottom: 12 }}>
            {tr.checkoutPage.bookingCancelledTitle}
          </h1>
          <p style={{ opacity: 0.7, marginBottom: 24 }}>
            {tr.checkoutPage.bookingCancelledBody}
          </p>
          <Link
            href={`/events/${state.booking.event.id}`}
            style={{ color: 'var(--afa-terracotta)', fontWeight: 600 }}
          >
            {tr.checkoutPage.backToEventLabel}
          </Link>
        </main>
      </>
    )
  }

  // --- Expired reservation
  if (state.booking.isExpired) {
    return (
      <>
        <SiteNav />
        <main style={{ padding: '48px 24px', maxWidth: 560, margin: '0 auto', fontFamily: 'system-ui' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, marginBottom: 12 }}>
            {tr.checkoutPage.reservationExpiredTitle}
          </h1>
          <p style={{ opacity: 0.7, marginBottom: 24 }}>
            {tr.checkoutPage.reservationExpiredBody}
          </p>
          <Link
            href={`/events/${state.booking.event.id}`}
            style={{
              background: 'var(--afa-terracotta)',
              color: 'white',
              padding: '12px 20px',
              borderRadius: 10,
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            {tr.checkoutPage.backToEventLabel}
          </Link>
        </main>
      </>
    )
  }

  // --- Payment not configured for this env (prod today)
  if (!state.payment || !state.payment.keyId) {
    return (
      <>
        <SiteNav />
        <main style={{ padding: '48px 24px', maxWidth: 560, margin: '0 auto', fontFamily: 'system-ui' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, marginBottom: 12 }}>
            {tr.checkoutPage.paymentsNotLiveTitle}
          </h1>
          <p style={{ opacity: 0.7, marginBottom: 24 }}>
            {tr.checkoutPage.seatsReservedNotice}
          </p>
          <Link
            href="/tickets"
            style={{ color: 'var(--afa-terracotta)', fontWeight: 600 }}
          >
            {tr.checkoutPage.viewMyReservationsArrow}
          </Link>
        </main>
      </>
    )
  }

  // --- Normal checkout state
  return (
    <>
      <SiteNav backHref={`/events/${state.booking.event.id}`} backLabel={tr.checkoutPage.backToEventLabel} />
      <main
        style={{
          padding: '32px 20px',
          maxWidth: 560,
          margin: '0 auto',
          fontFamily: 'system-ui, sans-serif',
          color: 'var(--afa-text-primary)',
        }}
      >
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 900, marginBottom: 8 }}>
          {tr.checkoutPage.confirmYourBooking}
        </h1>
        <p style={{ opacity: 0.6, marginBottom: 24, fontSize: 14 }}>
          {tr.checkoutPage.reserveSeatsNotice}
        </p>

        <div
          style={{
            background: 'white',
            border: '1px solid rgba(14,12,10,0.08)',
            borderRadius: 14,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            {state.booking.event.title}
          </div>
          <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 16 }}>
            {new Date(state.booking.event.date).toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}{' '}
            · {formatEventTimeRange(state.booking.event.startTime, state.booking.event.endTime)}
            {state.booking.event.venue && (
              <>
                {' · '}
                {state.booking.event.venue.name}, {state.booking.event.venue.city}
              </>
            )}
          </div>

          <div
            style={{
              borderTop: '1px solid rgba(14,12,10,0.06)',
              paddingTop: 16,
              marginBottom: 12,
            }}
          >
            {numberedGroups.length > 0
              ? numberedGroups.map((g) => (
                  <div
                    key={`${g.level}::${g.tierLabel}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      fontSize: 14,
                    }}
                  >
                    <span>
                      {g.tierLabel}{g.level ? ` · ${g.level}` : ''} × {g.count}
                      <span style={{ fontSize: 11, opacity: 0.6, display: 'block', marginTop: 2 }}>
                        {g.count === 1 ? tr.checkoutPage.seatWordCapSingular : tr.checkoutPage.seatWordCapPlural} {g.seatLabels.join(', ')}
                      </span>
                    </span>
                    <span style={{ opacity: 0.7 }}>
                      {g.price !== null ? formatDisplayMoney(g.price * g.count, displayCurrency) : '—'}
                    </span>
                  </div>
                ))
              : gaSeatEntries.map(([section, qty]) => (
                  <div
                    key={section}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      fontSize: 14,
                    }}
                  >
                    <span>
                      {section} × {qty}
                    </span>
                    <span style={{ opacity: 0.7 }}>
                      {formatDisplayMoney(state.booking.subtotalAmount, displayCurrency)}
                    </span>
                  </div>
                ))}
            {state.booking.bookingFeeAmount > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0 4px',
                  fontSize: 13,
                  opacity: 0.75,
                  borderTop: '1px dashed rgba(14,12,10,0.08)',
                  marginTop: 6,
                }}
              >
                <span>
                  {tr.eventDetailPage.bookingFeeLabel}
                  <span style={{ fontSize: 11, opacity: 0.75, display: 'block', marginTop: 2 }}>
                    {tr.checkoutPage.bookingFeeHintCheckout}
                  </span>
                </span>
                <span>
                  {formatDisplayMoney(state.booking.bookingFeeAmount, displayCurrency)}
                </span>
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid rgba(14,12,10,0.08)',
              paddingTop: 16,
            }}
          >
            <span style={{ fontSize: 14, opacity: 0.6 }}>{tr.eventDetailPage.totalLabel}</span>
            <span style={{ fontSize: 22, fontWeight: 700 }}>
              {state.booking.totalAmount > 0 ? formatDisplayMoney(state.booking.totalAmount, displayCurrency) : tr.eventDetailPage.freeAmount}
            </span>
          </div>
        </div>

        {/* Companion Tagging Phase 1 (reputation epic §7) - optional, never
            blocks payment. Search is disabled until consent is checked,
            since the API itself refuses to create tags without it. */}
        <div
          style={{
            background: 'white',
            border: '1px solid rgba(14,12,10,0.08)',
            borderRadius: 14,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{tr.checkoutPage.tagYourBuddies}</div>
          <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 12 }}>
            {tr.checkoutPage.tagBuddiesIntro}
            {companionMax !== null && (
              <>
                {' '}
                {companionMax === 0
                  ? tr.checkoutPage.noExtraSeatToTag
                  : tr.checkoutPage.upToCompanionsTemplate
                      .replace('{max}', String(companionMax))
                      .replace('{word}', companionMax === 1 ? tr.checkoutPage.companionSingular : tr.checkoutPage.companionPlural)
                      .replace('{seats}', String(companionMax + 1))}
              </>
            )}
          </p>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, opacity: 0.75, marginBottom: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={companionConsent}
              onChange={(e) => toggleCompanionConsent(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>
              {tr.checkoutPage.companionConsentLabel}
            </span>
          </label>

          {companionTags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: companionConsent ? 12 : 0 }}>
              {companionTags.map((t) => (
                <span
                  key={t.id}
                  style={{
                    fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6,
                    background: 'var(--afa-surface-raised)', borderRadius: 999, padding: '5px 6px 5px 12px',
                  }}
                >
                  {t.taggedUser.displayName || t.taggedUser.name}
                  <span style={{ opacity: 0.5, fontSize: 11 }}>
                    {t.status === 'PENDING' ? tr.checkoutPage.companionPending : t.status === 'ACCEPTED' ? tr.checkoutPage.companionConfirmed : tr.checkoutPage.companionDeclined}
                  </span>
                  <button
                    onClick={() => removeCompanion(t.id)}
                    disabled={companionBusy}
                    aria-label={tr.checkoutPage.removeAriaLabelTemplate.replace('{name}', t.taggedUser.name)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.5, padding: '0 4px' }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {companionConsent && (
            companionMax !== null && companionTags.filter((t) => t.status !== 'DECLINED').length >= companionMax ? (
              companionMax > 0 && (
                <p style={{ fontSize: 12.5, opacity: 0.55, fontStyle: 'italic' }}>
                  {tr.checkoutPage.maxTaggedNoticeTemplate.replace('{max}', String(companionMax))}
                </p>
              )
            ) : (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={companionQuery}
                onChange={(e) => setCompanionQuery(e.target.value)}
                placeholder={tr.checkoutPage.searchByNamePlaceholder}
                disabled={companionBusy}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 13.5, borderRadius: 8,
                  border: '1px solid rgba(14,12,10,0.15)', boxSizing: 'border-box',
                }}
              />
              {companionSearching && (
                <div style={{ fontSize: 12, opacity: 0.5, marginTop: 6 }}>{tr.checkoutPage.searchingEllipsis}</div>
              )}
              {companionResults.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {companionResults
                    .filter((u) => !companionTags.some((t) => t.taggedUser.id === u.id))
                    .map((u) => (
                      <button
                        key={u.id}
                        onClick={() => addCompanion(u)}
                        disabled={companionBusy}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(14,12,10,0.08)',
                          background: 'transparent', cursor: companionBusy ? 'default' : 'pointer', fontSize: 13.5,
                        }}
                      >
                        <span>{u.displayName || u.name} <span style={{ opacity: 0.5, fontSize: 12 }}>@{u.name}</span></span>
                        <span style={{ color: 'var(--afa-terracotta)', fontWeight: 600, fontSize: 12 }}>{tr.checkoutPage.tagButtonLabel}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
            )
          )}

          {companionError && (
            <div style={{ fontSize: 12, color: 'var(--afa-error)', marginTop: 8 }}>{companionError}</div>
          )}
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(179,38,30,0.08)',
              color: 'var(--afa-error)',
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={paying || confirming}
          style={{
            width: '100%',
            background: 'var(--afa-terracotta)',
            color: 'white',
            padding: 16,
            border: 'none',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 700,
            cursor: paying || confirming ? 'default' : 'pointer',
            opacity: paying || confirming ? 0.7 : 1,
          }}
        >
          {confirming
            ? tr.checkoutPage.confirmingYourBooking
            : paying
              ? tr.checkoutPage.openingPayment
              : state.booking.totalAmount > 0
                ? `${tr.checkoutPage.payPrefix} ${formatDisplayMoney(state.booking.totalAmount, displayCurrency)}`
                : tr.eventDetailPage.confirmFreeBooking}
        </button>

        <div
          style={{
            textAlign: 'center',
            fontSize: 12,
            opacity: 0.5,
            marginTop: 14,
            lineHeight: 1.6,
          }}
        >
          {tr.checkoutPage.securePaymentFooterCheckout}
        </div>
      </main>
    </>
  )
}
