'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'

// /dashboard/admin/settings
//
// Admin-only page for tuning platform-wide config. Right now that's
// just the audience booking fee. Kept as its own page (rather than a
// section on the main admin dashboard) because this list is going to
// grow — SMS provider, ticket layout, email templates — and mixing
// approvals-queue work with configuration knobs on one screen makes
// both harder to find.
//
// The fee is stored in paise on the DB (matching Payment.amount) but
// the UI shows/accepts rupees, since that's what a human types. The
// two-way conversion is done here so backend stays paise-only.

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [feeRupees, setFeeRupees] = useState<string>('')
  const [initialPaise, setInitialPaise] = useState<number>(0)
  const [maxPaise, setMaxPaise] = useState<number>(50000)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (!session?.user) return
    ;(async () => {
      try {
        const res = await fetch('/api/admin/platform-settings')
        if (res.status === 403) {
          setForbidden(true)
          return
        }
        if (!res.ok) throw new Error('Failed to load settings')
        const data = await res.json()
        const paise = data.settings.audienceBookingFee
        setInitialPaise(paise)
        setFeeRupees((paise / 100).toString())
        setMaxPaise(data.limits.maxBookingFeePaise)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [session])

  const save = async () => {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const rupees = Number(feeRupees)
      if (!Number.isFinite(rupees) || rupees < 0) {
        throw new Error('Booking fee must be zero or positive')
      }
      const paise = Math.round(rupees * 100)
      const res = await fetch('/api/admin/platform-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audienceBookingFee: paise }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setInitialPaise(data.settings.audienceBookingFee)
      setMessage(
        data.settings.audienceBookingFee === 0
          ? 'Saved. No booking fee will be charged.'
          : `Saved. New bookings will be charged ₹${(data.settings.audienceBookingFee / 100).toLocaleString('en-IN')} per booking.`
      )
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const currentPaise = Math.round(Number(feeRupees || 0) * 100)
  const isDirty = currentPaise !== initialPaise
  const isValid = Number.isFinite(Number(feeRupees)) && Number(feeRupees) >= 0

  if (loading) {
    return (
      <>
        <SiteNav />
        <div style={{ padding: 32, fontFamily: 'system-ui', color: '#0E0C0A' }}>
          Loading settings…
        </div>
      </>
    )
  }

  if (forbidden) {
    return (
      <>
        <SiteNav />
        <main style={{ padding: '48px 24px', maxWidth: 560, margin: '0 auto', fontFamily: 'system-ui' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, marginBottom: 12 }}>
            Admins only
          </h1>
          <p style={{ opacity: 0.7 }}>
            This page is only visible to platform admins.
          </p>
          <Link href="/" style={{ color: '#C8441A', fontWeight: 600 }}>
            ← Home
          </Link>
        </main>
      </>
    )
  }

  return (
    <>
      <SiteNav />
      <main
        style={{
          padding: '32px 20px 64px',
          maxWidth: 640,
          margin: '0 auto',
          fontFamily: 'system-ui, sans-serif',
          color: '#0E0C0A',
        }}
      >
        <div style={{ fontSize: 12, color: '#8a827a', marginBottom: 6, letterSpacing: '0.04em' }}>
          <Link href="/dashboard/admin" style={{ color: '#8a827a', textDecoration: 'none' }}>
            ← Admin
          </Link>{' '}
          / Settings
        </div>

        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 900, marginBottom: 8 }}>
          Platform settings
        </h1>
        <p style={{ opacity: 0.65, marginBottom: 28, fontSize: 14, lineHeight: 1.5 }}>
          Changes here take effect immediately — the next booking anyone starts will use the new values.
        </p>

        {message && (
          <div
            style={{
              padding: '12px 14px',
              background: '#F0FFF4',
              border: '1px solid #68D391',
              borderRadius: 8,
              color: '#276749',
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            {message}
          </div>
        )}
        {error && (
          <div
            style={{
              padding: '12px 14px',
              background: '#FDECEA',
              border: '1px solid #F5C2C0',
              borderRadius: 8,
              color: '#B3261E',
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            background: 'white',
            border: '1px solid rgba(14,12,10,0.08)',
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
            Audience booking fee
          </h2>
          <p style={{ fontSize: 13, color: '#8a827a', lineHeight: 1.6, marginBottom: 16 }}>
            A small flat fee added to each paid ticket at checkout — the platform's only revenue at MVP. Shown to audiences as a separate line item with a short "supports the artist ecosystem" note. Set to ₹0 to disable entirely; free events are never charged a fee regardless.
          </p>

          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: '#C8441A',
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}
          >
            FEE (₹)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18, opacity: 0.5 }}>₹</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="1"
              value={feeRupees}
              onChange={(e) => setFeeRupees(e.target.value)}
              placeholder="0"
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid rgba(14,12,10,0.15)',
                fontSize: 15,
              }}
            />
          </div>
          <p style={{ fontSize: 11, color: '#8a827a', marginBottom: 20 }}>
            Maximum: ₹{(maxPaise / 100).toLocaleString('en-IN')}. Rupees only; fractions are rounded to the nearest paise on save.
          </p>

          <button
            onClick={save}
            disabled={saving || !isDirty || !isValid}
            style={{
              background: '#C8441A',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: saving || !isDirty || !isValid ? 'default' : 'pointer',
              opacity: saving || !isDirty || !isValid ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div style={{ marginTop: 32, fontSize: 12, color: '#8a827a', lineHeight: 1.6 }}>
          <strong style={{ color: '#0E0C0A', fontWeight: 700 }}>Current behavior:</strong>{' '}
          {initialPaise === 0
            ? "No booking fee is being charged. Checkout, ticket PDFs, and email receipts show only the ticket price."
            : `A ₹${(initialPaise / 100).toLocaleString('en-IN')} booking fee is added to every paid booking, shown as a separate line item on the checkout page.`}
        </div>
      </main>
    </>
  )
}
