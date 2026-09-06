'use client'

import { formatDisplayMoney, type DisplayCurrency } from '@/lib/money-display'

// Mobile Redesign Phase 3 (GEN-2609-005) - ported from the Figma Make
// export's FeeSheet.tsx. That mock hardcoded every row to a static ₹500
// illustration ("Ticket face value ₹500 / Platform commission ₹0 /
// Booking fee ₹0 / afa ₹0" across the board) - per the brief's ambiguity
// #4, real implementation derives every number from the actual booking
// instead. The commission-is-zero callout below was confirmed accurate
// by Hitesh (6 Sep) and is kept as static copy - but the "Booking /
// convenience fee" row is NOT always zero in production (see
// GET /api/platform-settings/audience-fee - `audienceBookingFee` is a
// real, admin-configurable fee the platform keeps, separate from
// commission), so that row's "AFA takes" value is real, not hardcoded.
export function FeeSheet({
  ticketFaceValue,
  bookingFee,
  currency,
  onClose,
}: {
  ticketFaceValue: number
  bookingFee: number
  currency: DisplayCurrency | null
  onClose: () => void
}) {
  const zero = formatDisplayMoney(0, currency)
  const rows: { label: string; hint?: string; you: string; afa: string }[] = [
    { label: 'Ticket face value', you: formatDisplayMoney(ticketFaceValue, currency), afa: zero },
    { label: 'Platform commission', you: zero, afa: zero },
    { label: 'Booking / convenience fee', you: zero, afa: formatDisplayMoney(bookingFee, currency) },
    { label: 'Payment gateway', you: 'at cost', afa: 'absorbed' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <button
        aria-label="Close"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,10,0.6)', border: 'none', cursor: 'pointer' }}
      />
      <div
        style={{
          position: 'relative',
          borderTop: '1px solid rgba(245,245,240,0.1)',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          background: 'var(--afa-surface-raised)',
          paddingBottom: 32,
          maxWidth: 560,
          width: '100%',
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
          <div style={{ height: 4, width: 40, borderRadius: 999, background: 'rgba(245,245,240,0.15)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 4px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--afa-text-primary)', margin: 0 }}>
            Fee breakdown
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 36, width: 36, borderRadius: '50%',
              background: 'var(--afa-surface-page)', color: 'var(--afa-text-secondary)',
              border: 'none', cursor: 'pointer', fontSize: 18,
            }}
          >
            ×
          </button>
        </div>
        <p style={{ padding: '4px 20px 0', fontSize: 14, lineHeight: 1.6, color: 'var(--afa-text-secondary)' }}>
          On a {formatDisplayMoney(ticketFaceValue, currency)} ticket, here&rsquo;s exactly where the money goes.
        </p>

        <div style={{ margin: '20px 20px 0', overflow: 'hidden', borderRadius: 16, border: '1px solid rgba(245,245,240,0.08)' }}>
          <div
            style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 16,
              background: 'var(--afa-surface-page)', padding: '10px 16px',
              fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: 'var(--afa-text-muted)',
            }}
          >
            <span>Line</span>
            <span style={{ textAlign: 'right' }}>Artist/venue</span>
            <span style={{ textAlign: 'right' }}>AFA takes</span>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.label}
              style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 16, padding: '12px 16px',
                borderTop: i > 0 ? '1px solid rgba(245,245,240,0.06)' : undefined,
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--afa-text-primary)', opacity: 0.8 }}>{r.label}</span>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--afa-amber)' }}>{r.you}</span>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--afa-text-secondary)' }}>{r.afa}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            margin: '16px 20px 0', padding: '16px', borderRadius: 16,
            border: '1px solid rgba(201,151,58,0.3)', background: 'rgba(201,151,58,0.08)',
          }}
        >
          <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--afa-amber)' }}>
            Artist &amp; venue share: 100% · ₹0 commission
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--afa-text-secondary)' }}>
            We keep the lights on through venue subscriptions and optional artist promotions — never by taxing your
            ticket.
          </p>
        </div>
      </div>
    </div>
  )
}
