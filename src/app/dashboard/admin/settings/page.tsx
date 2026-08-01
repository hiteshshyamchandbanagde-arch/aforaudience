'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import { useToast } from '@/components/Toast'

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
  const [minFeeRupees, setMinFeeRupees] = useState<string>('')
  const [maxFeeRupees, setMaxFeeRupees] = useState<string>('')
  const [initialPaise, setInitialPaise] = useState<number>(0)
  const [initialMinPaise, setInitialMinPaise] = useState<number>(0)
  const [initialMaxPaise, setInitialMaxPaise] = useState<number>(50000)
  const [maxPaise, setMaxPaise] = useState<number>(50000) // absolute code ceiling, not the admin-set max
  const [chatCap, setChatCap] = useState<string>('')
  const [initialChatCap, setInitialChatCap] = useState<number>(15)
  const [maxChatCap, setMaxChatCap] = useState<number>(200)
  const [chatSaving, setChatSaving] = useState(false)

  // Scene Status thresholds (reputation epic §1, amended session 55) —
  // Rising and Featured only. Headliner is deliberately not here at all —
  // fully manual/admin-toggle-only, no formula, no config.
  const [risingMinGigs, setRisingMinGigs] = useState<string>('')
  const [risingMinAvgRating, setRisingMinAvgRating] = useState<string>('')
  const [risingMinAttendees, setRisingMinAttendees] = useState<string>('')
  const [featuredVouchThreshold, setFeaturedVouchThreshold] = useState<string>('')
  const [initialRisingMinGigs, setInitialRisingMinGigs] = useState<number>(3)
  const [initialRisingMinAvgRating, setInitialRisingMinAvgRating] = useState<number>(4.0)
  const [initialRisingMinAttendees, setInitialRisingMinAttendees] = useState<number>(5)
  const [initialFeaturedVouchThreshold, setInitialFeaturedVouchThreshold] = useState<number>(5)
  const [sceneStatusSaving, setSceneStatusSaving] = useState(false)

  // Admin artist roster (session 56) - Hype Score lookback window,
  // separate save action from the Scene Status thresholds above since
  // it's a display/aggregation setting, not a tier input.
  const [rosterLookback, setRosterLookback] = useState<string>('')
  const [initialRosterLookback, setInitialRosterLookback] = useState<number>(5)
  const [rosterLookbackSaving, setRosterLookbackSaving] = useState(false)

  // Display currency rates (Option A). One row per non-INR currency;
  // rateInputs holds the live-edited value per code, savingCode tracks
  // which row (if any) is mid-save, so each row's button state is
  // independent - editing one currency doesn't disable the others.
  const [currencyRates, setCurrencyRates] = useState<
    { code: string; label: string; symbol: string; rateFromINR: number }[]
  >([])
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({})
  const [savingCode, setSavingCode] = useState<string | null>(null)
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [loadError, setLoadError] = useState('')

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

        const minPaise = data.settings.minAudienceBookingFee
        const maxBandPaise = data.settings.maxAudienceBookingFee
        setInitialMinPaise(minPaise)
        setInitialMaxPaise(maxBandPaise)
        setMinFeeRupees((minPaise / 100).toString())
        setMaxFeeRupees((maxBandPaise / 100).toString())

        const cap = data.settings.chatMaxMessagesPerSession
        setInitialChatCap(cap)
        setChatCap(String(cap))
        setMaxChatCap(data.limits.maxChatMessagesCap)

        const rGigs = data.settings.sceneStatusRisingMinGigs
        const rRating = data.settings.sceneStatusRisingMinAvgRating
        const rAttendees = data.settings.sceneStatusRisingMinAttendees
        const fThreshold = data.settings.sceneStatusFeaturedVouchThreshold
        setInitialRisingMinGigs(rGigs)
        setInitialRisingMinAvgRating(rRating)
        setInitialRisingMinAttendees(rAttendees)
        setInitialFeaturedVouchThreshold(fThreshold)
        setRisingMinGigs(String(rGigs))
        setRisingMinAvgRating(String(rRating))
        setRisingMinAttendees(String(rAttendees))
        setFeaturedVouchThreshold(String(fThreshold))

        const lookback = data.settings.artistRosterHypeScoreLookback
        setInitialRosterLookback(lookback)
        setRosterLookback(String(lookback))
      } catch (err: any) {
        setLoadError(err.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [session])

  // Independent of the platform-settings load above - a failure here
  // shouldn't block the booking-fee/chat-cap sections from working.
  useEffect(() => {
    if (!session?.user) return
    ;(async () => {
      try {
        const res = await fetch('/api/admin/display-currencies')
        if (!res.ok) return
        const data = await res.json()
        const rows = (data.currencies ?? []).filter((c: { code: string }) => c.code !== 'INR')
        setCurrencyRates(rows)
        const inputs: Record<string, string> = {}
        for (const c of rows) inputs[c.code] = String(c.rateFromINR)
        setRateInputs(inputs)
      } catch {
        // Non-fatal - the section just won't populate.
      }
    })()
  }, [session])

  const saveCurrencyRate = async (code: string) => {
    setSavingCode(code)
    try {
      const rate = Number(rateInputs[code])
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error('Rate must be a positive number')
      }
      const res = await fetch('/api/admin/display-currencies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, rateFromINR: rate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setCurrencyRates((prev) =>
        prev.map((c) => (c.code === code ? { ...c, rateFromINR: data.currency.rateFromINR } : c))
      )
      showToast(`Saved. 1 INR = ${data.currency.rateFromINR} ${code} for display purposes.`, 'success')
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error')
    } finally {
      setSavingCode(null)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const minRupees = Number(minFeeRupees)
      const rupees = Number(feeRupees)
      const maxRupees = Number(maxFeeRupees)
      if (![minRupees, rupees, maxRupees].every((n) => Number.isFinite(n) && n >= 0)) {
        throw new Error('Min, standard, and max fee must all be zero or positive')
      }
      if (!(minRupees <= rupees && rupees <= maxRupees)) {
        throw new Error('Min must be ≤ standard, and standard must be ≤ max')
      }
      const res = await fetch('/api/admin/platform-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minAudienceBookingFee: Math.round(minRupees * 100),
          audienceBookingFee: Math.round(rupees * 100),
          maxAudienceBookingFee: Math.round(maxRupees * 100),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setInitialPaise(data.settings.audienceBookingFee)
      setInitialMinPaise(data.settings.minAudienceBookingFee)
      setInitialMaxPaise(data.settings.maxAudienceBookingFee)
      showToast(
        data.settings.audienceBookingFee === 0
          ? 'Saved. No booking fee will be charged by default.'
          : `Saved. New bookings default to ₹${(data.settings.audienceBookingFee / 100).toLocaleString('en-IN')}, adjustable between ₹${(data.settings.minAudienceBookingFee / 100).toLocaleString('en-IN')} and ₹${(data.settings.maxAudienceBookingFee / 100).toLocaleString('en-IN')}.`,
        'success'
      )
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const currentPaise = Math.round(Number(feeRupees || 0) * 100)
  const currentMinPaise = Math.round(Number(minFeeRupees || 0) * 100)
  const currentMaxPaise = Math.round(Number(maxFeeRupees || 0) * 100)
  const isDirty =
    currentPaise !== initialPaise || currentMinPaise !== initialMinPaise || currentMaxPaise !== initialMaxPaise
  const isValid =
    [minFeeRupees, feeRupees, maxFeeRupees].every((v) => Number.isFinite(Number(v)) && Number(v) >= 0) &&
    Number(minFeeRupees) <= Number(feeRupees) &&
    Number(feeRupees) <= Number(maxFeeRupees)

  const saveChatCap = async () => {
    setChatSaving(true)
    try {
      const cap = Number(chatCap)
      if (!Number.isInteger(cap)) {
        throw new Error('Message cap must be a whole number')
      }
      const res = await fetch('/api/admin/platform-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatMaxMessagesPerSession: cap }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setInitialChatCap(data.settings.chatMaxMessagesPerSession)
      showToast(
        data.settings.chatMaxMessagesPerSession <= 0
          ? 'Saved. Chat is now disabled — visitors see a "temporarily unavailable" message and the feedback form.'
          : `Saved. Visitors can send up to ${data.settings.chatMaxMessagesPerSession} messages per browser session before being pointed to the feedback form.`,
        'success'
      )
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error')
    } finally {
      setChatSaving(false)
    }
  }

  const currentChatCap = Math.round(Number(chatCap || 0))
  const isChatCapDirty = currentChatCap !== initialChatCap
  const isChatCapValid = Number.isInteger(Number(chatCap))

  const saveSceneStatusThresholds = async () => {
    setSceneStatusSaving(true)
    try {
      const gigs = Number(risingMinGigs)
      const rating = Number(risingMinAvgRating)
      const attendees = Number(risingMinAttendees)
      const threshold = Number(featuredVouchThreshold)
      if (!Number.isInteger(gigs) || gigs < 0) throw new Error('Min gigs must be a non-negative whole number')
      if (!Number.isFinite(rating) || rating < 0 || rating > 5) throw new Error('Min avg rating must be between 0 and 5')
      if (!Number.isInteger(attendees) || attendees < 0) throw new Error('Min attendees must be a non-negative whole number')
      if (!Number.isInteger(threshold) || threshold < 1) throw new Error('Featured vouch threshold must be a positive whole number')

      const res = await fetch('/api/admin/platform-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneStatusRisingMinGigs: gigs,
          sceneStatusRisingMinAvgRating: rating,
          sceneStatusRisingMinAttendees: attendees,
          sceneStatusFeaturedVouchThreshold: threshold,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setInitialRisingMinGigs(data.settings.sceneStatusRisingMinGigs)
      setInitialRisingMinAvgRating(data.settings.sceneStatusRisingMinAvgRating)
      setInitialRisingMinAttendees(data.settings.sceneStatusRisingMinAttendees)
      setInitialFeaturedVouchThreshold(data.settings.sceneStatusFeaturedVouchThreshold)
      showToast('Saved. Scene Status thresholds are live-computed, so this takes effect immediately — no deploy needed.', 'success')
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error')
    } finally {
      setSceneStatusSaving(false)
    }
  }

  const isSceneStatusDirty =
    Math.round(Number(risingMinGigs || 0)) !== initialRisingMinGigs ||
    Number(risingMinAvgRating) !== initialRisingMinAvgRating ||
    Math.round(Number(risingMinAttendees || 0)) !== initialRisingMinAttendees ||
    Math.round(Number(featuredVouchThreshold || 0)) !== initialFeaturedVouchThreshold
  const isSceneStatusValid =
    Number.isInteger(Number(risingMinGigs)) &&
    Number(risingMinGigs) >= 0 &&
    Number.isFinite(Number(risingMinAvgRating)) &&
    Number(risingMinAvgRating) >= 0 &&
    Number(risingMinAvgRating) <= 5 &&
    Number.isInteger(Number(risingMinAttendees)) &&
    Number(risingMinAttendees) >= 0 &&
    Number.isInteger(Number(featuredVouchThreshold)) &&
    Number(featuredVouchThreshold) >= 1

  const saveRosterLookback = async () => {
    setRosterLookbackSaving(true)
    try {
      const lookback = Number(rosterLookback)
      if (!Number.isInteger(lookback) || lookback < 1) {
        throw new Error('Lookback must be a positive whole number')
      }
      const res = await fetch('/api/admin/platform-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistRosterHypeScoreLookback: lookback }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setInitialRosterLookback(data.settings.artistRosterHypeScoreLookback)
      showToast('Saved.', 'success')
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error')
    } finally {
      setRosterLookbackSaving(false)
    }
  }
  const isRosterLookbackDirty = Math.round(Number(rosterLookback || 0)) !== initialRosterLookback
  const isRosterLookbackValid = Number.isInteger(Number(rosterLookback)) && Number(rosterLookback) >= 1

  if (loading) {
    return (
      <>
        <SiteNav />
        <div style={{ padding: 32, fontFamily: 'system-ui', color: 'var(--afa-ink)' }}>
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
          <Link href="/" style={{ color: 'var(--afa-terracotta)', fontWeight: 600 }}>
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
          color: 'var(--afa-ink)',
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--afa-taupe)', marginBottom: 6, letterSpacing: '0.04em' }}>
          <Link href="/dashboard/admin" style={{ color: 'var(--afa-taupe)', textDecoration: 'none' }}>
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

        {loadError && (
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--afa-error-bg)',
              border: '1px solid var(--afa-error-border)',
              borderRadius: 8,
              color: 'var(--afa-error)',
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            {loadError}
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
          <p style={{ fontSize: 13, color: 'var(--afa-taupe)', lineHeight: 1.6, marginBottom: 16 }}>
            A small flat fee added to each paid ticket at checkout — the platform's only revenue at MVP. Audiences can adjust it within the band below; "standard" is what's pre-filled for them. Shown as a separate line item with a short "supports the artist ecosystem" note. Set standard and min to ₹0 to make the fee fully optional; free events are never charged a fee regardless.
          </p>

          {([
            { label: 'MINIMUM (₹)', value: minFeeRupees, set: setMinFeeRupees, placeholder: '0' },
            { label: 'STANDARD (₹)', value: feeRupees, set: setFeeRupees, placeholder: '0' },
            { label: 'MAXIMUM (₹)', value: maxFeeRupees, set: setMaxFeeRupees, placeholder: '0' },
          ] as const).map((f) => (
            <div key={f.label}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--afa-terracotta)',
                  letterSpacing: '0.06em',
                  marginBottom: 6,
                }}
              >
                {f.label}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18, opacity: 0.5 }}>₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="1"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid rgba(14,12,10,0.15)',
                    fontSize: 15,
                  }}
                />
              </div>
            </div>
          ))}
          {Number(minFeeRupees) > Number(feeRupees) || Number(feeRupees) > Number(maxFeeRupees) ? (
            <p style={{ fontSize: 11, color: 'var(--afa-error, #b3261e)', marginBottom: 8 }}>
              Min must be ≤ standard, and standard must be ≤ max.
            </p>
          ) : null}
          <p style={{ fontSize: 11, color: 'var(--afa-taupe)', marginBottom: 20 }}>
            Absolute ceiling (code-level, requires a deploy to change): ₹{(maxPaise / 100).toLocaleString('en-IN')}. Rupees only; fractions are rounded to the nearest paise on save.
          </p>

          <button
            onClick={save}
            disabled={saving || !isDirty || !isValid}
            style={{
              background: 'var(--afa-terracotta)',
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

        <div
          style={{
            background: 'white',
            border: '1px solid rgba(14,12,10,0.08)',
            borderRadius: 12,
            padding: 24,
            marginTop: 20,
          }}
        >
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
            Support chat message cap
          </h2>
          <p style={{ fontSize: 13, color: 'var(--afa-taupe)', lineHeight: 1.6, marginBottom: 16 }}>
            The support chatbot is free to use for everyone — guests and paying audience alike — no gate, no login required. This cap only bounds how many messages a single visitor can send per browser session, as a cost/abuse guard. Once reached, the chat tab points them to the feedback form instead. Set to 0 to disable chat entirely (emergency killswitch) without a deploy.
          </p>

          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--afa-terracotta)',
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}
          >
            MAX MESSAGES PER SESSION
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step="1"
              value={chatCap}
              onChange={(e) => setChatCap(e.target.value)}
              placeholder="15"
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid rgba(14,12,10,0.15)',
                fontSize: 15,
              }}
            />
          </div>
          <p style={{ fontSize: 11, color: 'var(--afa-taupe)', marginBottom: 20 }}>
            Maximum: {maxChatCap}. A new browser session (new tab, cleared storage, or a different device) gets a fresh count — this is a soft cost guard, not a hard security boundary.
          </p>

          <button
            onClick={saveChatCap}
            disabled={chatSaving || !isChatCapDirty || !isChatCapValid}
            style={{
              background: 'var(--afa-terracotta)',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: chatSaving || !isChatCapDirty || !isChatCapValid ? 'default' : 'pointer',
              opacity: chatSaving || !isChatCapDirty || !isChatCapValid ? 0.5 : 1,
            }}
          >
            {chatSaving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div
          style={{
            background: 'white',
            border: '1px solid rgba(14,12,10,0.08)',
            borderRadius: 12,
            padding: 24,
            marginBottom: 20,
          }}
        >
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
            Scene Status thresholds
          </h2>
          <p style={{ fontSize: 13, color: 'var(--afa-taupe)', lineHeight: 1.6, marginBottom: 16 }}>
            Rising and Featured are automatic, computed live on every profile/poster view — changes here take effect immediately, no deploy needed. Headliner isn't configurable here — it's a fully manual, admin-only tag (set per-artist), deliberately not earned via any formula.
          </p>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--afa-terracotta)', letterSpacing: '0.06em', marginBottom: 6 }}>
            RISING — MIN COMPLETED GIGS
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step="1"
            value={risingMinGigs}
            onChange={(e) => setRisingMinGigs(e.target.value)}
            placeholder="3"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(14,12,10,0.15)', fontSize: 15, marginBottom: 16 }}
          />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--afa-terracotta)', letterSpacing: '0.06em', marginBottom: 6 }}>
            RISING — MIN AVERAGE REVIEW RATING (0–5)
          </label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={5}
            step="0.1"
            value={risingMinAvgRating}
            onChange={(e) => setRisingMinAvgRating(e.target.value)}
            placeholder="4.0"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(14,12,10,0.15)', fontSize: 15, marginBottom: 16 }}
          />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--afa-terracotta)', letterSpacing: '0.06em', marginBottom: 6 }}>
            RISING — MIN VERIFIED ATTENDEES
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step="1"
            value={risingMinAttendees}
            onChange={(e) => setRisingMinAttendees(e.target.value)}
            placeholder="5"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(14,12,10,0.15)', fontSize: 15, marginBottom: 16 }}
          />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--afa-terracotta)', letterSpacing: '0.06em', marginBottom: 6 }}>
            FEATURED — MIN DISTINCT ORGANISERS WHO VOUCHED
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step="1"
              value={featuredVouchThreshold}
              onChange={(e) => setFeaturedVouchThreshold(e.target.value)}
              placeholder="5"
              style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(14,12,10,0.15)', fontSize: 15 }}
            />
          </div>
          <p style={{ fontSize: 11, color: 'var(--afa-taupe)', marginBottom: 20 }}>
            Counted by distinct organiser, not raw vouch count — one organiser repeat-booking the same artist can't single-handedly push them to Featured.
          </p>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--afa-terracotta)', letterSpacing: '0.06em', marginBottom: 6 }}>
            ADMIN ROSTER — HYPE SCORE LOOKBACK (RECENT N SCORED SHOWS)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step="1"
              value={rosterLookback}
              onChange={(e) => setRosterLookback(e.target.value)}
              placeholder="5"
              style={{ width: 100, padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(14,12,10,0.15)', fontSize: 15 }}
            />
            <button
              onClick={saveRosterLookback}
              disabled={rosterLookbackSaving || !isRosterLookbackDirty || !isRosterLookbackValid}
              style={{
                background: 'var(--afa-terracotta)',
                color: 'white',
                padding: '9px 16px',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: rosterLookbackSaving || !isRosterLookbackDirty || !isRosterLookbackValid ? 'default' : 'pointer',
                opacity: rosterLookbackSaving || !isRosterLookbackDirty || !isRosterLookbackValid ? 0.5 : 1,
              }}
            >
              {rosterLookbackSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--afa-taupe)', marginBottom: 20 }}>
            Used only on the <Link href="/dashboard/admin/artists" style={{ color: 'var(--afa-terracotta)', fontWeight: 700 }}>Artists roster</Link> — averages each artist's most recent N shows that have a scored Hype Score (shows with no score yet are skipped, not counted as zero).
          </p>

          <button
            onClick={saveSceneStatusThresholds}
            disabled={sceneStatusSaving || !isSceneStatusDirty || !isSceneStatusValid}
            style={{
              background: 'var(--afa-terracotta)',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: sceneStatusSaving || !isSceneStatusDirty || !isSceneStatusValid ? 'default' : 'pointer',
              opacity: sceneStatusSaving || !isSceneStatusDirty || !isSceneStatusValid ? 0.5 : 1,
            }}
          >
            {sceneStatusSaving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div
          style={{
            background: 'white',
            border: '1px solid rgba(14,12,10,0.08)',
            borderRadius: 12,
            padding: 24,
            marginTop: 20,
          }}
        >
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
            Display currency rates
          </h2>
          <p style={{ fontSize: 13, color: 'var(--afa-taupe)', lineHeight: 1.6, marginBottom: 16 }}>
            Rates behind the display-only currency preference in profiles and checkout — a user who picks e.g. USD sees prices converted at this rate alongside the real ₹ amount. Manually set, not a live feed; update here whenever a rate drifts noticeably. Real charges and settlement are always in Indian Rupees regardless of these values.
          </p>

          {currencyRates.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--afa-taupe)' }}>No currencies configured yet.</p>
          ) : (
            currencyRates.map((c) => {
              const inputValue = rateInputs[c.code] ?? String(c.rateFromINR)
              const isDirtyRow = Number(inputValue) !== c.rateFromINR
              const isValidRow = Number.isFinite(Number(inputValue)) && Number(inputValue) > 0
              return (
                <div
                  key={c.code}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 14,
                    paddingBottom: 14,
                    borderBottom: '1px solid rgba(14,12,10,0.06)',
                  }}
                >
                  <div style={{ width: 92, fontSize: 14, flexShrink: 0 }}>
                    {c.symbol} {c.code}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--afa-taupe)', flexShrink: 0 }}>1 ₹ =</div>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.0001"
                    value={inputValue}
                    onChange={(e) => setRateInputs((prev) => ({ ...prev, [c.code]: e.target.value }))}
                    style={{
                      width: 110,
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid rgba(14,12,10,0.15)',
                      fontSize: 14,
                    }}
                  />
                  <button
                    onClick={() => saveCurrencyRate(c.code)}
                    disabled={savingCode === c.code || !isDirtyRow || !isValidRow}
                    style={{
                      background: 'var(--afa-terracotta)',
                      color: 'white',
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: savingCode === c.code || !isDirtyRow || !isValidRow ? 'default' : 'pointer',
                      opacity: savingCode === c.code || !isDirtyRow || !isValidRow ? 0.5 : 1,
                    }}
                  >
                    {savingCode === c.code ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div style={{ marginTop: 32, fontSize: 12, color: 'var(--afa-taupe)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--afa-ink)', fontWeight: 700 }}>Current behavior:</strong>{' '}
          {initialPaise === 0 && initialMinPaise === 0
            ? 'No booking fee is charged by default, and audiences can leave it at ₹0. Checkout, ticket PDFs, and email receipts show only the ticket price unless they raise it.'
            : `A ₹${(initialPaise / 100).toLocaleString('en-IN')} booking fee is pre-filled on every paid booking, adjustable by the audience between ₹${(initialMinPaise / 100).toLocaleString('en-IN')} and ₹${(initialMaxPaise / 100).toLocaleString('en-IN')}, shown as a separate line item on the checkout page.`}
        </div>
      </main>
    </>
  )
}
