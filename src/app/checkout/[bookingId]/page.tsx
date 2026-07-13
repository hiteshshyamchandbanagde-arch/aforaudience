'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
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
    totalAmount: number
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

export default function CheckoutPage() {
  const params = useParams<{ bookingId: string }>()
  const bookingId = params?.bookingId
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()

  const [state, setState] = useState<BookingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [scriptReady, setScriptReady] = useState(false)

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
        if (!res.ok) throw new Error(data.error || 'Failed to load booking')
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
        throw new Error(confirmData.error || 'Payment confirmation failed')
      }
      setConfirmed(true)
    } catch (err: any) {
      if (err?.code === 'DISMISSED') {
        // User just closed the modal. Don't treat as an error — let
        // them try again.
        return
      }
      setError(err?.message || 'Payment failed')
    } finally {
      setPaying(false)
      setConfirming(false)
    }
  }

  if (authStatus === 'loading' || loading) {
    return (
      <>
        <SiteNav />
        <div style={{ padding: 32, fontFamily: 'system-ui', color: '#0E0C0A' }}>
          Loading your checkout…
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
            Something went wrong
          </h1>
          <p style={{ color: '#B3261E', marginBottom: 24 }}>{error || 'Booking not found'}</p>
          <Link href="/events" style={{ color: '#C8441A', fontWeight: 600 }}>
            ← Back to events
          </Link>
        </div>
      </>
    )
  }

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
            color: '#0E0C0A',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎉</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 900, marginBottom: 12 }}>
            You're in!
          </h1>
          <p style={{ opacity: 0.7, lineHeight: 1.6, marginBottom: 24 }}>
            Your booking for <strong>{state.booking.event.title}</strong> is confirmed.
            {state.booking.event.venue && (
              <>
                {' '}
                We'll see you at {state.booking.event.venue.name}, {state.booking.event.venue.city}.
              </>
            )}
          </p>
          <div
            style={{
              background: '#F7F3EE',
              border: '1px solid rgba(14,12,10,0.08)',
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 6 }}>Booking ID</div>
            <div style={{ fontFamily: 'monospace', fontSize: 14, marginBottom: 12 }}>
              {state.booking.id}
            </div>
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 6 }}>Seats</div>
            <div style={{ fontSize: 14, marginBottom: 12 }}>
              {Object.entries(state.booking.seats)
                .filter(([, q]) => Number(q) > 0)
                .map(([s, q]) => `${s} × ${q}`)
                .join(', ')}
            </div>
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 6 }}>Amount paid</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              ₹{state.booking.totalAmount.toLocaleString('en-IN')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link
              href="/tickets"
              style={{
                background: '#C8441A',
                color: 'white',
                padding: '12px 20px',
                borderRadius: 10,
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              View my tickets →
            </Link>
            <Link
              href="/events"
              style={{
                color: '#0E0C0A',
                padding: '12px 20px',
                borderRadius: 10,
                fontWeight: 600,
                textDecoration: 'none',
                border: '1px solid rgba(14,12,10,0.15)',
                display: 'inline-block',
              }}
            >
              Browse more events
            </Link>
          </div>
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
            This booking was cancelled
          </h1>
          <p style={{ opacity: 0.7, marginBottom: 24 }}>
            If you still want to attend, head back to the event and book again.
          </p>
          <Link
            href={`/events/${state.booking.event.id}`}
            style={{ color: '#C8441A', fontWeight: 600 }}
          >
            ← Back to event
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
            Your reservation expired
          </h1>
          <p style={{ opacity: 0.7, marginBottom: 24 }}>
            We only hold seats for 15 minutes so others can book too. Head back to the event and pick your seats again — should only take a moment.
          </p>
          <Link
            href={`/events/${state.booking.event.id}`}
            style={{
              background: '#C8441A',
              color: 'white',
              padding: '12px 20px',
              borderRadius: 10,
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            ← Back to event
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
            Online payments aren't live yet
          </h1>
          <p style={{ opacity: 0.7, marginBottom: 24 }}>
            Your seats are reserved. We'll email you when checkout is ready to complete this booking.
          </p>
          <Link
            href="/tickets"
            style={{ color: '#C8441A', fontWeight: 600 }}
          >
            View my reservations →
          </Link>
        </main>
      </>
    )
  }

  // --- Normal checkout state
  const seatLines = Object.entries(state.booking.seats).filter(
    ([, q]) => Number(q) > 0
  ) as [string, number][]

  return (
    <>
      <SiteNav backHref={`/events/${state.booking.event.id}`} backLabel="← Back to event" />
      <main
        style={{
          padding: '32px 20px',
          maxWidth: 560,
          margin: '0 auto',
          fontFamily: 'system-ui, sans-serif',
          color: '#0E0C0A',
        }}
      >
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 900, marginBottom: 8 }}>
          Confirm your booking
        </h1>
        <p style={{ opacity: 0.6, marginBottom: 24, fontSize: 14 }}>
          Reserve seats now — pay in the next 15 minutes to lock them in.
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
            · {state.booking.event.startTime} – {state.booking.event.endTime}
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
            {seatLines.map(([section, qty]) => (
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
              </div>
            ))}
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
            <span style={{ fontSize: 14, opacity: 0.6 }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 700 }}>
              ₹{state.booking.totalAmount.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(179,38,30,0.08)',
              color: '#B3261E',
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
            background: '#C8441A',
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
            ? 'Confirming your booking…'
            : paying
              ? 'Opening payment…'
              : `Pay ₹${state.booking.totalAmount.toLocaleString('en-IN')}`}
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
          Payments handled securely by Razorpay. UPI, card, and netbanking supported.
        </div>
      </main>
    </>
  )
}
