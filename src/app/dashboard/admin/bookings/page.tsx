'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import SiteNav from '@/components/SiteNav'
import DashboardShell from '@/components/DashboardShell'

// /dashboard/admin/bookings
//
// The surface that finally lets an admin see, without a DB console or
// curl, which CONFIRMED bookings hit a ticket-delivery error and
// click "retry" instead of firing the redeliver endpoint manually.
//
// The retry endpoint itself (POST /api/admin/redeliver-ticket/[id])
// shipped in the eighth amendment; this page just gives it a
// legitimate UI. Filter tabs are server-driven (one refetch per tab)
// so the counts stay accurate even if a background delivery lands
// while the admin is looking at a stale tab.
//
// Deliberately small: no pagination beyond a fixed limit, no per-user
// search, no sort. Booking volume today is ~20 rows lifetime. Add
// controls when a real backlog exists.

interface BookingItem {
  id: string
  status: string
  totalAmount: number
  subtotalAmount: number
  bookingFeeAmount: number
  createdAt: string
  deliveredAt: string | null
  deliveryError: string | null
  user: { name: string | null; email: string | null; displayName: string | null }
  event: { title: string; date: string; isFree: boolean } | null
  payment: {
    status: string
    razorpayPaymentId: string | null
    amount: number
  } | null
}

interface Counts {
  errored: number
  delivered: number
  pending: number
  all: number
}

type Tab = 'errored' | 'pending' | 'delivered' | 'all'

export default function AdminBookingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('errored')
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [counts, setCounts] = useState<Counts>({ errored: 0, delivered: 0, pending: 0, all: 0 })
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [retryMessage, setRetryMessage] = useState<{ id: string; kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const load = useCallback(async (currentTab: Tab) => {
    setLoading(true)
    const res = await fetch(`/api/admin/bookings?status=${currentTab}&limit=100`)
    if (res.status === 403) {
      setForbidden(true)
      setLoading(false)
      return
    }
    if (res.ok) {
      const data = await res.json()
      setBookings(data.bookings)
      setCounts(data.counts)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (session?.user) load(tab)
  }, [session, tab, load])

  const retry = async (id: string) => {
    setRetryingId(id)
    setRetryMessage(null)
    try {
      const res = await fetch(`/api/admin/redeliver-ticket/${id}`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setRetryMessage({ id, kind: 'ok', text: 'Retry queued — delivery in flight.' })
        // Give the background delivery ~2s to write its result, then
        // refresh the list so the row moves to the right tab.
        setTimeout(() => load(tab), 2000)
      } else {
        const err =
          res.status === 409
            ? 'Booking was updated too recently to safely retry (30s cooldown, or booking is under 5 min old).'
            : body.error || `Retry failed (${res.status}).`
        setRetryMessage({ id, kind: 'err', text: err })
      }
    } catch (e: any) {
      setRetryMessage({ id, kind: 'err', text: e?.message || 'Network error' })
    } finally {
      setRetryingId(null)
    }
  }

  if (status === 'loading') {
    return (
      <>
        <SiteNav />
        <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)' }}>
          <div style={{ padding: '32px', color: 'var(--afa-text-primary)' }}>Loading…</div>
        </main>
      </>
    )
  }
  if (!session) return <SiteNav />

  if (forbidden) {
    return (
      <>
        <SiteNav />
        <DashboardShell>
        <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', marginBottom: '12px', color: 'var(--afa-text-primary)' }}>
              Admin access only
            </h1>
            <p style={{ color: 'var(--afa-text-secondary)' }}>This page is restricted to platform administrators.</p>
          </div>
        </main>
        </DashboardShell>
      </>
    )
  }

  const tabButton = (id: Tab, label: string, count: number) => {
    const active = id === tab
    return (
      <button
        key={id}
        onClick={() => setTab(id)}
        style={{
          padding: '7px 14px',
          borderRadius: '999px',
          border: active ? '1px solid transparent' : '1px solid rgba(245,245,240,0.14)',
          background: active ? 'rgba(201,151,58,0.15)' : 'transparent',
          color: active ? 'var(--afa-amber)' : 'var(--afa-text-secondary)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {label} <span style={{ opacity: 0.7, marginLeft: '4px' }}>({count})</span>
      </button>
    )
  }

  const formatMoney = (rupees: number) => `₹${rupees.toLocaleString('en-IN')}`
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })

  const rowState = (b: BookingItem): { label: string; color: string } => {
    if (b.deliveredAt) return { label: 'Delivered', color: 'var(--afa-green-deep)' }
    if (b.deliveryError) return { label: 'Delivery failed', color: 'var(--afa-error)' }
    return { label: 'Pending delivery', color: 'var(--afa-amber)' }
  }

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 20px 80px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '4px' }}>
            Bookings &amp; delivery
          </h1>
          <p style={{ color: 'var(--afa-text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
            Confirmed bookings, grouped by ticket-delivery state. Retry re-fires the delivery pipeline on failed
            attempts (30-second cooldown enforced by the endpoint).
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
            {tabButton('errored', 'Failed', counts.errored)}
            {tabButton('pending', 'Pending delivery', counts.pending)}
            {tabButton('delivered', 'Delivered', counts.delivered)}
            {tabButton('all', 'All confirmed', counts.all)}
          </div>

          {loading ? (
            <div style={{ padding: '32px 0', color: 'var(--afa-text-secondary)' }}>Loading bookings…</div>
          ) : bookings.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--afa-text-secondary)' }}>
              {tab === 'errored'
                ? 'Nothing failed. Ticket delivery is healthy.'
                : tab === 'pending'
                ? 'No pending deliveries.'
                : 'No bookings match this filter.'}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {bookings.map((b) => {
                const s = rowState(b)
                const isErrored = !b.deliveredAt && !!b.deliveryError
                const isDelivered = !!b.deliveredAt
                const displayName = b.user.displayName || b.user.name || '—'
                return (
                  <div
                    key={b.id}
                    style={{
                      background: 'var(--afa-surface-page)',
                      borderRadius: '12px',
                      padding: '18px 20px',
                      border: '1px solid rgba(245,245,240,0.08)',
                    }}
                  >
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--afa-text-primary)', marginBottom: '2px' }}>
                          {b.event?.title || 'Event deleted'}
                          {b.event?.isFree ? (
                            <span style={{ marginLeft: '8px', fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(245,245,240,0.08)', color: 'var(--afa-text-secondary)', fontWeight: 500 }}>
                              FREE
                            </span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--afa-text-secondary)', marginBottom: '6px' }}>
                          {displayName} — {b.user.email}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--afa-text-secondary)', opacity: 0.7, fontFamily: 'ui-monospace, monospace' }}>
                          {b.id}
                        </div>
                      </div>
                      <div className="text-left lg:text-right" style={{ fontSize: '13px', flexShrink: 0 }}>
                        <div style={{ fontWeight: 600, color: s.color }}>{s.label}</div>
                        <div style={{ color: 'var(--afa-text-secondary)', marginTop: '2px' }}>{formatDate(b.createdAt)}</div>
                        {isDelivered && b.deliveredAt ? (
                          <div style={{ color: 'var(--afa-text-secondary)', marginTop: '2px', fontSize: '12px' }}>
                            Delivered {formatDate(b.deliveredAt)}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ marginTop: '10px', fontSize: '13px', display: 'flex', gap: '16px', flexWrap: 'wrap', color: 'var(--afa-text-secondary)' }}>
                      <span>Total: <strong style={{ color: 'var(--afa-text-primary)' }}>{formatMoney(b.totalAmount)}</strong></span>
                      {b.bookingFeeAmount > 0 ? <span>Fee: {formatMoney(b.bookingFeeAmount)}</span> : null}
                      {b.payment ? (
                        <span>
                          Payment: {b.payment.status}
                          {b.payment.razorpayPaymentId ? ` • ${b.payment.razorpayPaymentId}` : ''}
                        </span>
                      ) : (
                        <span>No payment (free event)</span>
                      )}
                    </div>

                    {isErrored && b.deliveryError ? (
                      <div
                        style={{
                          marginTop: '12px',
                          padding: '10px 12px',
                          background: 'rgba(179,38,30,0.12)',
                          border: '1px solid rgba(179,38,30,0.3)',
                          borderRadius: '8px',
                          fontSize: '13px',
                          color: 'var(--afa-error)',
                          fontFamily: 'ui-monospace, monospace',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {b.deliveryError}
                      </div>
                    ) : null}

                    {retryMessage?.id === b.id ? (
                      <div
                        style={{
                          marginTop: '10px',
                          fontSize: '13px',
                          color: retryMessage.kind === 'ok' ? 'var(--afa-green-deep)' : 'var(--afa-error)',
                        }}
                      >
                        {retryMessage.text}
                      </div>
                    ) : null}

                    {!isDelivered ? (
                      <div style={{ marginTop: '12px' }}>
                        <button
                          onClick={() => retry(b.id)}
                          disabled={retryingId === b.id}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '999px',
                            border: 'none',
                            background: 'var(--afa-fill-solid)',
                            color: 'var(--afa-on-fill-solid)',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: retryingId === b.id ? 'default' : 'pointer',
                            opacity: retryingId === b.id ? 0.6 : 1,
                          }}
                        >
                          {retryingId === b.id
                            ? 'Retrying…'
                            : isErrored
                            ? 'Retry delivery'
                            : 'Attempt delivery'}
                        </button>
                      </div>
                    ) : null}
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
