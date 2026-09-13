'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'

// GEN-2609-042 - extracted from verify-phone/page.tsx so the onboarding
// welcome sequence's phone-verify screen reuses the exact same
// /api/auth/otp/request + /api/auth/otp/verify calls (purpose:
// SIGNUP_VERIFY) instead of forking the implementation. Error-message
// fallbacks are passed in by the caller rather than owned here, so each
// caller keeps its own localized copy (tr.*) instead of a hardcoded
// English default leaking in through the shared hook.
export function useOtpVerification() {
  const { update } = useSession()
  const [submitting, setSubmitting] = useState(false)
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [codeSent, setCodeSent] = useState(false)

  // `errorCodeMap` is verify-phone/page.tsx's tr.authErrors (BUG-2608-038 -
  // prefer the translated message for the server's stable error `code`
  // over the raw English `error` string). Optional so a caller without its
  // own code map (e.g. the welcome sequence, which doesn't need per-code
  // granularity) can just pass the fallback string.
  const sendCode = async (phone: string, fallbackError: string, errorCodeMap?: Record<string, string>) => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'SIGNUP_VERIFY', phone }),
      })
      const data = await res.json()
      if (!res.ok) {
        const code = typeof data.code === 'string' ? data.code : undefined
        throw new Error((code && errorCodeMap?.[code]) || data.error || fallbackError)
      }
      setDevOtp(data.devOtp ?? null)
      setCodeSent(true)
      return true
    } catch (err: any) {
      setError(err.message || fallbackError)
      return false
    } finally {
      setSubmitting(false)
    }
  }

  // Refreshes the session (isVerified) via next-auth's update() on
  // success, same as verify-phone/page.tsx always did - so the caller
  // doesn't need a full re-login to see isVerified flip to true.
  const verifyCode = async (phone: string, userId: string, code: string, fallbackError: string) => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, userId, code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || fallbackError)
      await update()
      return true
    } catch (err: any) {
      setError(err.message || fallbackError)
      return false
    } finally {
      setSubmitting(false)
    }
  }

  return { submitting, devOtp, error, codeSent, sendCode, verifyCode, setError }
}
