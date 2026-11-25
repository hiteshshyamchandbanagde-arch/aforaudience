'use client'

// D1b (Hitesh, 8 Nov) - organiser payment-mode picker, shared by Create
// Event and Edit Event. Three choices: Free / Pay at entry / Online
// payment. Online is only selectable while the S1a paid-bookings switch
// is ON; while OFF it is shown disabled with "Coming soon", except for an
// event that is already ONLINE, which stays checked and visible (never
// silently converted). The server (resolveEventPaymentMode) is the real
// enforcement; this is the UI.

import { useEffect, useState } from 'react'
import { useLocale } from '@/lib/i18n/translate'
import { type EventPaymentMode, onlineOptionState } from '@/lib/pay-at-entry'

/**
 * Reads the public paid-bookings flag. `null` while loading; a failed
 * fetch counts as OFF (the safe side - Online stays disabled and the
 * server refuses ONLINE anyway).
 */
export function usePaidBookingsEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/platform-settings/paid-bookings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setEnabled(data?.paidBookingsEnabled === true) })
      .catch(() => { if (!cancelled) setEnabled(false) })
    return () => { cancelled = true }
  }, [])
  return enabled
}

export default function PaymentModePicker({
  value,
  onChange,
  paidEnabled,
}: {
  value: EventPaymentMode
  onChange: (mode: EventPaymentMode) => void
  paidEnabled: boolean
}) {
  const { t } = useLocale()
  const p = t.payAtEntry
  const online = onlineOptionState(paidEnabled, value)

  const optionStyle = (disabled: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--afa-space-6px)',
    fontSize: 'var(--afa-text-body)',
    color: 'var(--afa-text-primary)',
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  })
  const hintStyle: React.CSSProperties = {
    fontSize: 'var(--afa-text-small)',
    color: 'var(--afa-text-primary)',
    opacity: 0.7,
    marginTop: 'var(--afa-space-2)',
    lineHeight: 1.5,
  }

  return (
    <fieldset
      data-testid="payment-mode-picker"
      style={{ border: 'none', padding: 0, margin: 0, marginBottom: 'var(--afa-space-18px)' }}
    >
      <legend style={{ fontSize: 'var(--afa-text-ui)', fontWeight: 600, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-10px)' }}>
        {p.modeLabel}
      </legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--afa-space-3) var(--afa-space-5)' }}>
        <label style={optionStyle(false)}>
          <input type="radio" name="paymentMode" value="FREE" checked={value === 'FREE'} onChange={() => onChange('FREE')} /> {p.modeFree}
        </label>
        <label style={optionStyle(false)}>
          <input type="radio" name="paymentMode" value="PAY_AT_ENTRY" checked={value === 'PAY_AT_ENTRY'} onChange={() => onChange('PAY_AT_ENTRY')} /> {p.modePayAtEntry}
        </label>
        <label style={optionStyle(online !== 'selectable')}>
          <input
            type="radio"
            name="paymentMode"
            value="ONLINE"
            checked={value === 'ONLINE'}
            disabled={online !== 'selectable'}
            onChange={() => onChange('ONLINE')}
          />{' '}
          {p.modeOnline}
          {online === 'disabled' && (
            <span
              data-testid="payment-mode-online-coming-soon"
              style={{ fontSize: 'var(--afa-text-small)', fontWeight: 600, padding: 'var(--afa-space-2px) var(--afa-space-2)', borderRadius: 'var(--afa-radius-pill)', background: 'var(--afa-tint-08)' }}
            >
              {p.modeOnlineComingSoon}
            </span>
          )}
        </label>
      </div>
      {value === 'PAY_AT_ENTRY' && (
        <p data-testid="payment-mode-pay-at-entry-help" style={hintStyle}>{p.modePayAtEntryHelp}</p>
      )}
      {online === 'kept' && (
        <p data-testid="payment-mode-online-kept" style={hintStyle}>{p.modeOnlineKept}</p>
      )}
    </fieldset>
  )
}
