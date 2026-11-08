'use client'

// D2 (Hitesh, 8 Nov) - direct-payment venue bookings for one side:
// status chip, payee block (venue named, owner's UPI ID with copy, amount,
// the "AforAudience does not collect" note) and that side's action button.
// AFA never shows its own UPI/QR. Design tokens only.

import { useEffect, useState } from 'react'
import { Card, StatusPill, Button, Field, type StatusPillTone } from '@/components/dashboard/VenuePortalUI'
import { useToast } from '@/components/Toast'
import { formatDate } from '@/lib/format-date'
import { formatINR } from '@/lib/money-display'
import { useLocale, type Dictionary } from '@/lib/i18n/translate'
import { refreshBadgeCounts } from '@/lib/badge-refresh'
import { venueBookingChip, type VenueBookingChip, type DirectPayAction } from '@/lib/venue-direct-pay'

type Item = {
  id: string
  status: string
  amount: number
  fromDate: string
  directPayStatus: string | null
  payerReference: string | null
  expiresAt: string | null
  venue: { name: string; city: string }
  organiser: { orgName: string }
  payee: { name: string; venueName: string; upiId: string | null }
}

type Strings = Dictionary['venueDirectPay']

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
          return (
            <Card key={b.id} data-afa-direct-pay-booking={b.id} style={{ padding: 'var(--afa-space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--afa-space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, color: 'var(--afa-text-primary)' }}>
                  {side === 'ORGANISER' ? b.venue.name : b.organiser.orgName} · {formatDate(b.fromDate, 'medium', locale)}
                </div>
                <span data-afa-direct-pay-chip={chip}>
                  <StatusPill tone={CHIP[chip].tone}>{s[CHIP[chip].label]}</StatusPill>
                </span>
              </div>

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
                  <div data-afa-payee-note style={muted}>{s.payNote.replace('{payee}', b.payee.venueName)}</div>
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
