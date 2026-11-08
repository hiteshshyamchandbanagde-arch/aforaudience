'use client'

// D3 (Hitesh, 8 Nov) - direct-payment performance fees / buy-ins for one
// side (artist gigs view or organiser lineup view). Same look as D2's
// DirectPayBookings: status chip, payee block (payee named, their UPI ID
// with copy, optional QR, amount, the "AforAudience does not collect"
// note) and the caller's action. Payer/payee come from the direction:
// PAID = organiser pays artist, BUY_IN = artist pays organiser. Design
// tokens only; AFA never shows its own UPI/QR.

import { useEffect, useState } from 'react'
import { Card, StatusPill, Button, Field, type StatusPillTone } from '@/components/dashboard/VenuePortalUI'
import { useToast } from '@/components/Toast'
import { formatDate } from '@/lib/format-date'
import { formatINR } from '@/lib/money-display'
import { useLocale, type Dictionary } from '@/lib/i18n/translate'
import type { DirectPayAction, VenueBookingChip } from '@/lib/venue-direct-pay'
import { performanceChip, type PerformanceParty } from '@/lib/performance-direct-pay'

type Item = {
  id: string
  compensationType: string
  amount: number
  payer: PerformanceParty | null
  payee: PerformanceParty | null
  directPayStatus: string | null
  payerReference: string | null
  expiresAt: string | null
  cancelledAt: string | null
  event: { id: string; title: string; date: string }
  artistName: string
  orgName: string
  payeeBlock: { name: string; upiId: string | null; upiQrUrl: string | null }
}

const CHIP: Record<VenueBookingChip, { tone: StatusPillTone; label: keyof Dictionary['venueDirectPay'] }> = {
  requested: { tone: 'gold', label: 'chipRequested' },
  awaitingPayment: { tone: 'gold', label: 'chipAwaitingPayment' },
  paymentMarked: { tone: 'gold', label: 'chipPaymentMarked' },
  confirmed: { tone: 'sage', label: 'chipConfirmed' },
  declined: { tone: 'error', label: 'chipDeclined' },
  expired: { tone: 'muted', label: 'chipExpired' },
  cancelled: { tone: 'muted', label: 'chipCancelled' },
}

export default function PerformanceDirectPay({ side, eventId }: { side: PerformanceParty; eventId?: string }) {
  const { locale, t } = useLocale()
  const v = t.venueDirectPay
  const s = t.performanceDirectPay
  const { showToast } = useToast()
  const [items, setItems] = useState<Item[]>([])
  const [refs, setRefs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    const q = eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''
    fetch(`/api/performances/direct-pay${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data) return
        const list: Item[] = side === 'ARTIST' ? data.asArtist : data.asOrganiser
        setItems(eventId ? list.filter((x) => x.event.id === eventId) : list)
      })
      // Panel is additive; the page's own list still loads.
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [side, eventId, tick])

  const act = async (id: string, action: DirectPayAction) => {
    setBusy(id)
    try {
      const res = await fetch(`/api/performances/${id}/direct-pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reference: refs[id] }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) showToast(body.error || 'Failed', 'error')
      setTick((n) => n + 1)
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
    <section data-afa-performance-direct-pay aria-label={s.title} style={{ marginBottom: 'var(--afa-space-6)' }}>
      <h2 style={{ fontSize: 'var(--afa-text-subheading)', fontWeight: 600, marginBottom: 'var(--afa-space-3)', color: 'var(--afa-text-primary)' }}>
        {s.title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-3)' }}>
        {items.map((p) => {
          const chip = performanceChip(p)
          const waiting = chip === 'awaitingPayment' || chip === 'paymentMarked'
          const iPay = p.payer === side
          return (
            <Card key={p.id} data-afa-direct-pay-performance={p.id} data-afa-direct-pay-role={iPay ? 'payer' : 'payee'} style={{ padding: 'var(--afa-space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--afa-space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, color: 'var(--afa-text-primary)' }}>
                  {p.event.title} · {side === 'ARTIST' ? p.orgName : p.artistName} · {formatDate(p.event.date, 'medium', locale)}
                </div>
                <span data-afa-direct-pay-chip={chip}>
                  <StatusPill tone={CHIP[chip].tone}>{v[CHIP[chip].label]}</StatusPill>
                </span>
              </div>
              <div style={{ ...muted, marginTop: 'var(--afa-space-1)' }}>
                {p.compensationType === 'BUY_IN' ? s.buyIn : s.fee}: {formatINR(p.amount)}
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
                    {v.amount}: <strong data-afa-payee-amount>{formatINR(p.amount)}</strong>
                  </div>
                  {p.payeeBlock.upiId ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-2)', flexWrap: 'wrap' }}>
                      <span style={muted}>{v.upiLabel}:</span>
                      <code data-afa-payee-upi style={{ fontFamily: 'var(--font-mono)', color: 'var(--afa-text-primary)', wordBreak: 'break-all' }}>
                        {p.payeeBlock.upiId}
                      </code>
                      {iPay && (
                        <Button variant="outline" type="button" onClick={() => copy(p.id, p.payeeBlock.upiId as string)}>
                          {copied === p.id ? v.copied : v.copy}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div data-afa-payee-cash-only style={muted}>{s.cashOnly}</div>
                  )}
                  {p.payeeBlock.upiQrUrl && (
                    // The payee's own UPI QR (never AFA's). Plain img: Blob URL, no next/image domain config.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      data-afa-payee-qr
                      src={p.payeeBlock.upiQrUrl}
                      alt={v.upiQrAlt.replace('{payee}', p.payeeBlock.name)}
                      style={{ width: '160px', height: '160px', objectFit: 'contain', borderRadius: 'var(--afa-radius-md)', border: '1px solid var(--afa-tint-08)', background: 'var(--afa-surface-inverse)' }}
                    />
                  )}
                  <div data-afa-payee-note style={muted}>{v.payNote.replace('{payee}', p.payeeBlock.name)}</div>
                  {p.payerReference && <div style={muted}>{v.reference.replace('{ref}', p.payerReference)}</div>}
                  {p.expiresAt && <div style={muted}>{v.expires.replace('{date}', formatDate(p.expiresAt, 'medium', locale))}</div>}
                </div>
              )}

              {waiting && (
                <div style={{ marginTop: 'var(--afa-space-3)', display: 'flex', gap: 'var(--afa-space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                  {iPay && chip === 'awaitingPayment' && (
                    <>
                      <Field
                        aria-label={v.referenceLabel}
                        placeholder={v.referenceLabel}
                        maxLength={100}
                        value={refs[p.id] ?? ''}
                        onChange={(e) => setRefs((r) => ({ ...r, [p.id]: e.target.value }))}
                        style={{ maxWidth: '280px' }}
                      />
                      <Button type="button" disabled={busy === p.id} onClick={() => act(p.id, 'markPaid')}>
                        {v.iPaid}
                      </Button>
                    </>
                  )}
                  {iPay && chip === 'paymentMarked' && <span style={muted}>{s.waitingPayee}</span>}
                  {!iPay && (
                    <>
                      {chip === 'awaitingPayment' && <span style={muted}>{s.waitingPayer}</span>}
                      <Button type="button" disabled={busy === p.id} onClick={() => act(p.id, 'confirmReceived')}>
                        {v.confirmReceived}
                      </Button>
                    </>
                  )}
                  <Button variant="outline" type="button" disabled={busy === p.id} onClick={() => act(p.id, 'cancel')}>
                    {iPay ? s.cancel : s.decline}
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
