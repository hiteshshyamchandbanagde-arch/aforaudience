'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'

const inputStyle = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: '8px',
  border: '1px solid rgba(14,12,10,0.15)',
  fontSize: '18px',
  letterSpacing: '0.3em',
  textAlign: 'center' as const,
  color: 'var(--afa-ink)',
}

// Standalone "verify your phone" completion flow. Before this page existed,
// the only entry point to phone OTP verification was the immediate
// post-registration screen in RegisterForm.tsx - once a user clicked past
// it (or their session ended before finishing), there was no way back in.
// This reuses the same /api/auth/otp/request + /api/auth/otp/verify
// endpoints (purpose: SIGNUP_VERIFY), just from a page reachable any time.
function VerifyPhoneInner() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/profile'

  const [loading, setLoading] = useState(true)
  const [phone, setPhone] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [alreadyVerified, setAlreadyVerified] = useState(false)

  const [otpCode, setOtpCode] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [codeSent, setCodeSent] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push(`/login?next=${encodeURIComponent(`/verify-phone?next=${next}`)}`)
  }, [status, router, next])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/users/me')
        if (!res.ok) throw new Error('Could not load your account.')
        const data = await res.json()
        setUserId(data.user.id)
        setPhone(data.user.phone)
        setAlreadyVerified(!!data.user.isVerified)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    if (session?.user) load()
  }, [session])

  const sendCode = async () => {
    if (!phone) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'SIGNUP_VERIFY', phone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not send code.')
      setDevOtp(data.devOtp ?? null)
      setCodeSent(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const verifyCode = async () => {
    if (!phone || !userId) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, userId, code: otpCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid code.')
      // Refresh the session so isVerified is current without re-login,
      // then continue wherever the user was trying to go (e.g. back to
      // checkout).
      await update()
      router.push(next)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading' || loading) {
    return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  }

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-cream)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '440px', margin: '0 auto', padding: '48px 24px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '8px' }}>
            Verify Your Phone
          </h1>

          {alreadyVerified ? (
            <div style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <p style={{ fontSize: '15px', color: 'var(--afa-ink)', marginBottom: '16px' }}>
                ✓ Your phone is already verified. Nothing to do here.
              </p>
              <Link href={next} style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-terracotta)', textDecoration: 'none' }}>
                Continue →
              </Link>
            </div>
          ) : (
            <div style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <p style={{ fontSize: '14px', color: 'var(--afa-ink)', opacity: 0.7, marginBottom: '20px' }}>
                Booking a ticket needs a verified phone on file - it's how we (and the event Organiser) can reach you
                about your booking. Verifying takes one code sent to <strong>{phone || 'your number on file'}</strong>.
              </p>

              {error && (
                <div style={{ background: 'var(--afa-error-bg)', border: '1px solid var(--afa-error-border)', borderRadius: '8px', padding: '12px 16px', marginBottom: '18px', fontSize: '13px', color: 'var(--afa-error)' }}>
                  {error}
                </div>
              )}
              {devOtp && (
                <div style={{ background: 'var(--afa-amber-tint)', border: '1px solid var(--afa-terracotta)', borderRadius: '8px', padding: '12px 16px', marginBottom: '18px', fontSize: '13px', color: 'var(--afa-ink)' }}>
                  QA Mode — dev OTP: <strong>{devOtp}</strong> (never shown in production)
                </div>
              )}

              {!codeSent ? (
                <button
                  onClick={sendCode}
                  disabled={submitting || !phone}
                  style={{ width: '100%', background: 'var(--afa-terracotta)', color: 'white', padding: '14px', borderRadius: '8px', border: 'none', fontSize: '15px', fontWeight: 600, cursor: 'pointer', opacity: submitting || !phone ? 0.6 : 1 }}
                >
                  {submitting ? 'Sending...' : 'Send verification code'}
                </button>
              ) : (
                <>
                  <input
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    maxLength={6}
                    placeholder="6-digit code"
                    onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
                    style={{ ...inputStyle, marginBottom: '16px' }}
                  />
                  <button
                    onClick={verifyCode}
                    disabled={submitting || otpCode.length !== 6}
                    style={{ width: '100%', background: 'var(--afa-terracotta)', color: 'white', padding: '14px', borderRadius: '8px', border: 'none', fontSize: '15px', fontWeight: 600, cursor: 'pointer', opacity: submitting || otpCode.length !== 6 ? 0.6 : 1, marginBottom: '10px' }}
                  >
                    {submitting ? 'Verifying...' : 'Verify'}
                  </button>
                  <button
                    onClick={sendCode}
                    disabled={submitting}
                    style={{ width: '100%', background: 'transparent', color: 'var(--afa-terracotta)', padding: '10px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
                  >
                    Resend code
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  )
}

export default function VerifyPhonePage() {
  return (
    <Suspense fallback={<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>}>
      <VerifyPhoneInner />
    </Suspense>
  )
}
