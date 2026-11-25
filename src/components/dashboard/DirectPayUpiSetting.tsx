'use client'

// D3 (Hitesh, 8 Nov) - "UPI ID (+ optional QR) for direct payments" card
// for the artist and organiser profile pages. Self-contained: loads from
// and saves to the caller's own profile API (/api/artists/me or
// /api/organisers/me), same validation as D2's venue owner setting. The
// QR reuses the existing image upload. Design tokens only.

import { useEffect, useState } from 'react'
import { Card, Button, Field } from '@/components/dashboard/VenuePortalUI'
import { useToast } from '@/components/Toast'
import { useLocale } from '@/lib/i18n/translate'

export default function DirectPayUpiSetting({ role }: { role: 'ARTIST' | 'ORGANISER' }) {
  const { t } = useLocale()
  const v = t.venueDirectPay
  const s = t.performanceDirectPay
  const { showToast } = useToast()
  const endpoint = role === 'ARTIST' ? '/api/artists/me' : '/api/organisers/me'
  const [upiId, setUpiId] = useState('')
  const [upiQrUrl, setUpiQrUrl] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return
        setUpiId(d.upiId || '')
        setUpiQrUrl(d.upiQrUrl || '')
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [endpoint])

  const uploadQr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload/avatar', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) showToast(data.error || 'Upload failed', 'error')
      else setUpiQrUrl(data.url)
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    setBusy(true)
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upiId: upiId.trim() || null, upiQrUrl: upiQrUrl || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) showToast(data.error || 'Failed', 'error')
      else showToast(v.upiSaved, 'success')
    } finally {
      setBusy(false)
    }
  }

  const muted = { fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-muted)', margin: 'var(--afa-space-1) 0 0' } as const

  return (
    <Card data-afa-upi-setting={role.toLowerCase()} style={{ padding: 'var(--afa-space-4)', marginBottom: 'var(--afa-space-6)' }}>
      <label style={{ display: 'block', fontWeight: 600, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-2)' }}>
        {s.upiSettingLabel}
        <Field
          aria-label={s.upiSettingLabel}
          value={upiId}
          onChange={(e) => setUpiId(e.target.value)}
          maxLength={256}
          placeholder="name@bank"
          autoComplete="off"
          style={{ marginTop: 'var(--afa-space-2)' }}
        />
      </label>
      <p style={muted}>{role === 'ARTIST' ? s.upiSettingHelpArtist : s.upiSettingHelpOrganiser}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-3)', marginTop: 'var(--afa-space-3)', flexWrap: 'wrap' }}>
        {upiQrUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img data-afa-upi-qr-preview src={upiQrUrl} alt={v.upiQrLabel} style={{ width: '96px', height: '96px', objectFit: 'contain', borderRadius: 'var(--afa-radius-md)', border: '1px solid var(--afa-tint-10)', background: 'var(--afa-surface-inverse)' }} />
        )}
        <label style={{ cursor: busy ? 'default' : 'pointer', color: 'var(--afa-text-primary)', textDecoration: 'underline', fontSize: 'var(--afa-text-ui)' }}>
          {v.upiQrUpload}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadQr} disabled={busy} style={{ display: 'none' }} />
        </label>
        {upiQrUrl && (
          <Button variant="outline" type="button" onClick={() => setUpiQrUrl('')}>
            {v.upiQrRemove}
          </Button>
        )}
        <Button type="button" disabled={busy} onClick={save} data-afa-upi-save>
          {v.upiSave}
        </Button>
      </div>
    </Card>
  )
}
