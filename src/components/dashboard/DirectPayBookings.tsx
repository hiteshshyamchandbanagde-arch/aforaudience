'use client'

// D2 (Hitesh, 8 Nov) - direct-payment venue bookings for one side:
// status chip, payee block (venue named, owner's UPI ID with copy, amount,
// the "AforAudience does not collect" note) and that side's action button.
// AFA never shows its own UPI/QR. Design tokens only.

import { useEffect, useState } from 'react'
import { Card, StatusPill, Button, Field, type StatusPillTone } from '@/components/dashboard/VenuePortalUI'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import { DIRECT_PAY_FULL_REFUND_MIN_DAYS } from '@/lib/direct-pay-terms'
import { formatDate } from '@/lib/format-date'
import { formatINR } from '@/lib/money-display'
import { useLocale, type Dictionary } from '@/lib/i18n/translate'
import { refreshBadgeCounts } from '@/lib/badge-refresh'
import {
  venueBookingChip,
  cancelConfirmedOutcome,
  hasBookingStarted,
  type VenueBookingChip,
  type DirectPayAction,
} from '@/lib/venue-direct-pay'

type Item = {
  id: string
  status: string
  amount: number
  fromDate: string
  directPayStatus: string | null
  payerReference: string | null
  expiresAt: string | null
  confirmedAt?: string | null
  directRefundStatus?: 'DUE' | 'AS_AGREED' | 'RECEIVED' | null
  cancelledBy?: 'ORGANISER' | 'VENUE_OWNER' | 'ARTIST' | null
  cancelledAt?: string | null
  refundReceivedAt?: string | null
  venue: { name: string; city: string }
  organiser: { orgName: string }
  payee: { name: string; venueName: string; upiId: string | null; upiQrUrl?: string | null }
}

type Strings = Dictionary['venueDirectPay']

const REFUND_CHIP: Record<'DUE' | 'AS_AGREED' | 'RECEIVED', { tone: StatusPillTone; label: keyof Strings }> = {
  DUE: { tone: 'gold', label: 'chipRefundDue' },
  AS_AGREED: { tone: 'muted', label: 'chipRefundAsAgreed' },
  RECEIVED: { tone: 'sage', label: 'chipRefundReceived' },
}

const CHIP: Record<VenueBookingChip, { tone: StatusPillTone; label: keyof Strings }> = {
  requested: { tone: 'gold', label: 'chipRequested' },
  awaitingPayment: { tone: 'gold', label: 'chipAwaitingPayment' },
  paymentMarked: { tone: 'gold', label: 'chipPaymentMarked' },
  confirmed: { tone: 'sage', label: 'chipConfirmed' },
  declined: { tone: 'error', label: 'chipDeclined' },
  expired: { tone: 'muted', label: 'chipExpired' },
  cancelled: { tone: 'muted', label: 'chipCancelled' },
}

async function fetchItems(side: 'ORGANISER' | 'VENUE_OWNER'): Promise<Item[] | null> {
  try {
    const res = await fetch('/api/venue-bookings/direct-pay')
    if (!res.ok) return null
    const data = await res.json()
    return side === 'ORGANISER' ? data.asOrganiser : data.asOwner
  } catch {
    // Panel is additive; the page's own list still loads.
    return null
  }
}

export default function DirectPayBookings({ side }: { side: 'ORGANISER' | 'VENUE_OWNER' }) {
  const { locale, t } = useLocale()
  const s = t.venueDirectPay
  const { showToast } = useToast()
  const confirm = useConfirm()
  const [items, setItems] = useState<Item[]>([])
  const [refs, setRefs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    fetchItems(side).then((list) => {
      if (alive && list) setItems(list)
    })
    return () => {
      alive = false
    }
  }, [side, tick])

  const act = async (id: string, action: DirectPayAction) => {
    setBusy(id)
    try {
      const res = await fetch(`/api/venue-bookings/${id}/direct-pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reference: refs[id] }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) showToast(body.error || 'Failed', 'error')
      setTick((n) => n + 1)
      refreshBadgeCounts()
    } finally {
      setBusy(null)
    }
  }

  // 12 Nov - cancel after CONFIRMED: the dialog states the refund outcome
  // (same helper the API uses) before anything changes.
  const cancelConfirmed = async (b: Item) => {
    const outcome = cancelConfirmedOutcome(b.fromDate, Date.now(), b.confirmedAt != null)
    const days = String(DIRECT_PAY_FULL_REFUND_MIN_DAYS)
    const line =
      outcome === 'DUE' ? s.cancelOutcomeDue : outcome === 'AS_AGREED' ? s.cancelOutcomeAsAgreed : s.cancelOutcomeNone
    const ok = await confirm({
      title: s.cancelConfirmedTitle,
      body: (
        <span data-afa-cancel-outcome={outcome ?? 'NONE'}>
          {line.replaceAll('{days}', days).replaceAll('{amount}', formatINR(b.amount))}
          {outcome && (
            <>
              <br />
              {s.cancelOutcomeNote}
            </>
          )}
        </span>
      ),
      confirmLabel: s.cancel,
      cancelLabel: s.keepBooking,
      destructive: true,
    })
    if (ok) await act(b.id, 'cancelConfirmed')
  }

  const copy = async (id: string, upi: string) => {
    try {
      await navigator.clipboard.writeText(upi)
      setCopied(id)
    } catch {
      // Clipboard blocked: the UPI ID is on screen to copy by hand.
    }
  }

  if (items.length === 0) return null

  const muted = { fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-secondary)' } as const

  return (
    <section data-afa-direct-pay-list aria-label={s.title} style={{ marginBottom: 'var(--afa-space-6)' }}>
      <h2 style={{ fontSize: 'var(--afa-text-subheading)', fontWeight: 600, marginBottom: 'var(--afa-space-3)', color: 'var(--afa-text-primary)' }}>
        {s.title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-3)' }}>
        {items.map((b) => {
          const chip = venueBookingChip(b)
          const waiting = chip === 'awaitingPayment' || chip === 'paymentMarked'
          const canCancelConfirmed = b.directPayStatus === 'CONFIRMED' && !hasBookingStarted(b.fromDate)
          const refund = b.directRefundStatus ? REFUND_CHIP[b.directRefundStatus] : null
          return (
            <Card key={b.id} data-afa-direct-pay-booking={b.id} style={{ padding: 'var(--afa-space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--afa-space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, color: 'var(--afa-text-primary)' }}>
                  {side === 'ORGANISER' ? b.venue.name : b.organiser.orgName} · {formatDate(b.fromDate, 'medium', locale)}
                </div>
                <span style={{ display: 'inline-flex', gap: 'var(--afa-space-2)', flexWrap: 'wrap' }}>
                  <span data-afa-direct-pay-chip={chip}>
                    <StatusPill tone={CHIP[chip].tone}>{s[CHIP[chip].label]}</StatusPill>
                  </span>
                  {refund && b.directRefundStatus && (
                    <span data-afa-refund-chip={b.directRefundStatus}>
                      <StatusPill tone={refund.tone}>
                        {s[refund.label].replace('{date}', b.refundReceivedAt ? formatDate(b.refundReceivedAt, 'medium', locale) : '').trim()}
                      </StatusPill>
                    </span>
                  )}
                </span>
              </div>

              {chip === 'cancelled' && b.cancelledBy && b.cancelledAt && (
                <div data-afa-cancelled-by={b.cancelledBy} style={{ ...muted, marginTop: 'var(--afa-space-2)' }}>
                  {s.cancelledByLine
                    .replace('{who}', b.cancelledBy === 'ORGANISER' ? s.partyOrganiser : s.partyVenueOwner)
                    .replace('{date}', formatDate(b.cancelledAt, 'medium', locale))}
                </div>
              )}

              {(canCancelConfirmed ||
                (side === 'ORGANISER' && (b.directRefundStatus === 'DUE' || b.directRefundStatus === 'AS_AGREED'))) && (
                <div style={{ marginTop: 'var(--afa-space-3)', display: 'flex', gap: 'var(--afa-space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                  {side === 'ORGANISER' && (b.directRefundStatus === 'DUE' || b.directRefundStatus === 'AS_AGREED') && (
                    <Button type="button" data-afa-refund-received-btn disabled={busy === b.id} onClick={() => act(b.id, 'refundReceived')}>
                      {s.iReceivedRefund}
                    </Button>
                  )}
                  {canCancelConfirmed && (
                    <Button variant="outline" type="button" data-afa-cancel-confirmed-btn disabled={busy === b.id} onClick={() => cancelConfirmed(b)}>
                      {s.cancel}
                    </Button>
                  )}
                </div>
              )}

              {waiting && (
                <div
                  data-afa-payee-block
                  style={{
                    marginTop: 'var(--afa-space-3)',
                    padding: 'var(--afa-space-3)',
                    borderRadius: 'var(--afa-radius-md)',
                    border: '1px solid var(--afa-tint-08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--afa-space-2)',
                  }}
                >
                  <div style={{ color: 'var(--afa-text-primary)' }}>
                    {s.amount}: <strong data-afa-payee-amount>{formatINR(b.amount)}</strong>
                  </div>
                  {b.payee.upiId ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-2)', flexWrap: 'wrap' }}>
                      <span style={muted}>{s.upiLabel}:</span>
                      <code data-afa-payee-upi style={{ fontFamily: 'var(--font-mono)', color: 'var(--afa-text-primary)', wordBreak: 'break-all' }}>
                        {b.payee.upiId}
                      </code>
                      <Button variant="outline" type="button" onClick={() => copy(b.id, b.payee.upiId as string)}>
                        {copied === b.id ? s.copied : s.copy}
                      </Button>
                    </div>
                  ) : (
                    <div data-afa-payee-cash-only style={muted}>{s.cashOnly}</div>
                  )}
                  {b.payee.upiQrUrl && (
                    // D2b - the owner's own UPI QR (never AFA's). Plain img: Blob URL, no next/image domain config.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      data-afa-payee-qr
                      src={b.payee.upiQrUrl}
                      alt={s.upiQrAlt.replace('{payee}', b.payee.venueName)}
                      style={{ width: '160px', height: '160px', objectFit: 'contain', borderRadius: 'var(--afa-radius-md)', border: '1px solid var(--afa-tint-08)', background: 'var(--afa-surface-inverse)' }}
                    />
                  )}
                  <div data-afa-payee-note style={muted}>{s.payNote.replace('{payee}', b.payee.venueName)}</div>
                  {/* S1b-c1 - all payments are direct cash/UPI; AFA never collects. */}
                  <div data-afa-direct-pay-disclosure style={muted}>{s.payDirectLine.replace('{name}', b.payee.venueName)}</div>
                  {/* 12 Nov - the 15-day direct-pay standard term, from direct-pay-terms.ts. */}
                  <div data-afa-direct-pay-refund-term style={muted}>{s.refundTermLine.replaceAll('{days}', String(DIRECT_PAY_FULL_REFUND_MIN_DAYS))}</div>
                  {b.payerReference && <div style={muted}>{s.reference.replace('{ref}', b.payerReference)}</div>}
                  {b.expiresAt && <div style={muted}>{s.expires.replace('{date}', formatDate(b.expiresAt, 'medium', locale))}</div>}
                </div>
              )}

              {waiting && (
                <div style={{ marginTop: 'var(--afa-space-3)', display: 'flex', gap: 'var(--afa-space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                  {side === 'ORGANISER' && chip === 'awaitingPayment' && (
                    <>
                      <Field
                        aria-label={s.referenceLabel}
                        placeholder={s.referenceLabel}
                        maxLength={100}
                        value={refs[b.id] ?? ''}
                        onChange={(e) => setRefs((r) => ({ ...r, [b.id]: e.target.value }))}
                        style={{ maxWidth: '280px' }}
                      />
                      <Button type="button" disabled={busy === b.id} onClick={() => act(b.id, 'markPaid')}>
                        {s.iPaid}
                      </Button>
                    </>
                  )}
                  {side === 'ORGANISER' && chip === 'paymentMarked' && <span style={muted}>{s.waitingOwner}</span>}
                  {side === 'VENUE_OWNER' && (
                    <>
                      {chip === 'awaitingPayment' && <span style={muted}>{s.waitingOrganiser}</span>}
                      <Button type="button" disabled={busy === b.id} onClick={() => act(b.id, 'confirmReceived')}>
                        {s.confirmReceived}
                      </Button>
                    </>
                  )}
                  <Button variant="outline" type="button" disabled={busy === b.id} onClick={() => act(b.id, 'cancel')}>
                    {s.cancel}
                  </Button>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </section>
  )
}
