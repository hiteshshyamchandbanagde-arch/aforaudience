'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import SiteNav from '@/components/SiteNav'
import DashboardShell from '@/components/DashboardShell'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { formatDate } from '@/lib/format-date'

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
  ticketCode: string | null
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
          <div style={{ padding: 'var(--afa-space-32px)', color: 'var(--afa-text-primary)' }}>Loading…</div>
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
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '80px var(--afa-space-6)', textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-heading)', marginBottom: 'var(--afa-space-3)', color: 'var(--afa-text-primary)' }}>
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
      <Button key={id} variant="toggle-pill" size="pill-sm" fullWidth={false} selected={active} onClick={() => setTab(id)}>
        {label} <span style={{ opacity: 0.7, marginLeft: 'var(--afa-space-1)' }}>({count})</span>
      </Button>
    )
  }

  const formatMoney = (rupees: number) => `₹${rupees.toLocaleString('en-IN')}`

  const rowState = (b: BookingItem): { label: string; color: string } => {
    if (b.deliveredAt) return { label: 'Delivered', color: 'var(--afa-green-deep)' }
    if (b.deliveryError) return { label: 'Delivery failed', color: 'var(--afa-error-bright)' }
    return { label: 'Pending delivery', color: 'var(--afa-amber)' }
  }

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: 'var(--afa-space-32px) var(--afa-space-5) 80px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-page-title)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-1)' }}>
            Bookings &amp; delivery
          </h1>
          <p style={{ color: 'var(--afa-text-secondary)', marginBottom: 'var(--afa-space-5)', fontSize: 'var(--afa-text-body)' }}>
            Confirmed bookings, grouped by ticket-delivery state. Retry re-fires the delivery pipeline on failed
            attempts (30-second cooldown enforced by the endpoint).
          </p>

          <div style={{ display: 'flex', gap: 'var(--afa-space-2)', flexWrap: 'wrap', marginBottom: 'var(--afa-space-6)' }}>
            {tabButton('errored', 'Failed', counts.errored)}
            {tabButton('pending', 'Pending delivery', counts.pending)}
            {tabButton('delivered', 'Delivered', counts.delivered)}
            {tabButton('all', 'All confirmed', counts.all)}
          </div>

          {loading ? (
            <div style={{ padding: 'var(--afa-space-32px) 0', color: 'var(--afa-text-secondary)' }}>Loading bookings…</div>
          ) : bookings.length === 0 ? (
            <div style={{ padding: 'var(--afa-space-48px) 0', textAlign: 'center', color: 'var(--afa-text-secondary)' }}>
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
                      borderRadius: 'var(--afa-radius-lg)',
                      padding: 'var(--afa-space-18px) var(--afa-space-5)',
                      border: '1px solid var(--afa-tint-08)',
                    }}
                  >
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--afa-text-body-lg)', fontWeight: 600, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-2px)' }}>
                          {b.event?.title || 'Event deleted'}
                          {b.event?.isFree ? (
                            <Badge variant="tag" tone={{ bg: 'var(--afa-tint-08)', color: 'var(--afa-text-secondary)' }} style={{ marginLeft: 'var(--afa-space-2)' }}>
                              FREE
                            </Badge>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-secondary)', marginBottom: 'var(--afa-space-6px)' }}>
                          {displayName} — {b.user.email}
                        </div>
                        <div style={{ fontSize: 'var(--afa-text-micro)', color: 'var(--afa-text-secondary)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                          {b.ticketCode ? `${b.ticketCode} · ${b.id}` : b.id}
                        </div>
                      </div>
                      <div className="text-left lg:text-right" style={{ fontSize: 'var(--afa-text-ui)', flexShrink: 0 }}>
                        <div style={{ fontWeight: 600, color: s.color }}>{s.label}</div>
                        <div style={{ color: 'var(--afa-text-secondary)', marginTop: 'var(--afa-space-2px)' }}>{formatDate(b.createdAt, 'dateTime')}</div>
                        {isDelivered && b.deliveredAt ? (
                          <div style={{ color: 'var(--afa-text-secondary)', marginTop: 'var(--afa-space-2px)', fontSize: 'var(--afa-text-small)' }}>
                            Delivered {formatDate(b.deliveredAt, 'dateTime')}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ marginTop: 'var(--afa-space-10px)', fontSize: 'var(--afa-text-ui)', display: 'flex', gap: 'var(--afa-space-4)', flexWrap: 'wrap', color: 'var(--afa-text-secondary)' }}>
                      <span>Total: <strong style={{ color: 'var(--afa-text-primary)' }}>{formatMoney(b.totalAmount)}</strong></span>
                      {b.bookingFeeAmount > 0 ? <span>Fee: {formatMoney(b.bookingFeeAmount)}</span> : null}
                      {b.payment ? (
                        <span>
                          Payment: {b.payment.status}
                          {b.payment.razorpayPaymentId ? ` • ${b.payment.razorpayPaymentId}` : ''}
                        </span>
                      ) : b.totalAmount === 0 ? (
                        <span>Free event</span>
                      ) : (
                        // BUG-2609-060 - a priced booking with no Payment row is
                        // an anomaly, not a free event; same amber warning tone
                        // as "Pending delivery" above.
                        <span style={{ color: 'var(--afa-amber)', fontWeight: 600 }}>No payment record</span>
                      )}
                    </div>

                    {isErrored && b.deliveryError ? (
                      <div
                        style={{
                          marginTop: 'var(--afa-space-3)',
                          padding: 'var(--afa-space-10px) var(--afa-space-3)',
                          background: 'var(--afa-error-tint)',
                          border: '1px solid var(--afa-error-edge)',
                          borderRadius: 'var(--afa-radius-md)',
                          fontSize: 'var(--afa-text-ui)',
                          color: 'var(--afa-error-bright)',
                          fontFamily: 'var(--font-mono)',
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
                          marginTop: 'var(--afa-space-10px)',
                          fontSize: 'var(--afa-text-ui)',
                          color: retryMessage.kind === 'ok' ? 'var(--afa-green-deep)' : 'var(--afa-error-bright)',
                        }}
                      >
                        {retryMessage.text}
                      </div>
                    ) : null}

                    {!isDelivered ? (
                      <div style={{ marginTop: 'var(--afa-space-3)' }}>
                        <Button
                          variant="primary"
                          size="pill-sm"
                          fullWidth={false}
                          onClick={() => retry(b.id)}
                          disabled={retryingId === b.id}
                        >
                          {retryingId === b.id
                            ? 'Retrying…'
                            : isErrored
                            ? 'Retry delivery'
                            : 'Attempt delivery'}
                        </Button>
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
