"use client"
import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import EnvBadge from "@/components/EnvBadge"
import BrandLoader from '@/components/BrandLoader'
import { useLocale } from '@/lib/i18n/translate'

type Mode = "password" | "otp-request" | "otp-verify"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t: tr } = useLocale()
  const registered = searchParams.get("registered")
  const justReset = searchParams.get("reset")
  const wasSuspended = searchParams.get("suspended")
  const wasIdle = searchParams.get("idle")
  // Feedback cmrzsmlus - if this login follows a registration that
  // started from a specific "Join As X" link, land the person on
  // Profile (where the "Become an X" application cards live) instead of
  // the generic homepage, which had no memory of why they signed up.
  const intendedRole = searchParams.get("role")
  const postLoginRedirect = () => router.push(intendedRole ? "/profile" : "/")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<Mode>("password")
  const [otpCode, setOtpCode] = useState("")
  const [devOtp, setDevOtp] = useState<string | null>(null) // only ever set in QA
  // Register got the eye-toggle for Feedback cmrlxz35q (PR #62); login was
  // missed in that PR. Same pattern, applied here as a same-day follow-up.
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async () => {
    setLoading(true); setError("")
    try {
      const result = await signIn("credentials", {
        identifier: identifier.trim(),
        password,
        redirect: false,
      })
      if (result?.error) {
        if (result.error === "LOCKED") {
          setError(tr.loginPage.lockedError)
        } else if (result.error === "SUSPENDED") {
          setError(tr.authCommon.accountSuspendedMessage)
        } else if (result.error === "CredentialsSignin") {
          setError(tr.loginPage.invalidCredentialsError)
        } else {
          setError(tr.loginPage.failedSignInError)
        }
        setLoading(false); return
      }
      postLoginRedirect()
    } catch {
      setError(tr.authCommon.somethingWentWrong)
      setLoading(false)
    }
  }

  const handleRequestOtp = async () => {
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "LOGIN", identifier: identifier.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        // `code` is a stable identifier the server returns alongside the
        // (English) `error` string - look up the translated message
        // instead of displaying raw English (BUG-2608-038, e.g. "No
        // account found for that identifier." leaking through in Hindi mode).
        const code = typeof data.code === "string" ? data.code : undefined
        const authErrors = tr.authErrors as Record<string, string>
        setError((code && authErrors[code]) || data.error || tr.loginPage.couldNotSendCodeError)
        setLoading(false); return
      }
      setDevOtp(data.devOtp ?? null)
      setMode("otp-verify")
      setLoading(false)
    } catch {
      setError(tr.loginPage.couldNotSendCodeError)
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    setLoading(true); setError("")
    try {
      const result = await signIn("otp-login", {
        identifier: identifier.trim(),
        code: otpCode,
        redirect: false,
      })
      if (result?.error) {
        if (result.error === "SUSPENDED") {
          setError(tr.authCommon.accountSuspendedMessage)
        } else {
          setError(tr.loginPage.invalidOrExpiredCodeError)
        }
        setLoading(false); return
      }
      postLoginRedirect()
    } catch {
      setError(tr.authCommon.somethingWentWrong)
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-[440px]">
      <div className="text-center mb-8">
        <Link href="/" className="font-serif text-[28px] font-bold text-[var(--afa-ink)] no-underline">
          <span className="text-[var(--afa-brand-mark)]">A</span>forAudience
          <EnvBadge />
        </Link>
        <p className="text-[14px] text-[var(--afa-ink)] opacity-50 mt-2">
          {tr.loginPage.welcomeBack}
        </p>
      </div>

      <div className="bg-white rounded-[16px] p-8 sm:p-10 border border-[rgba(14,12,10,0.08)] shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "24px" }}>
          {tr.loginPage.signInHeading}
        </h2>

        {registered && (
          <div style={{ background: "var(--afa-success-bg)", border: "1px solid #68D391", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "var(--afa-green-dark)" }}>
            {tr.loginPage.accountCreatedBanner}
          </div>
        )}
        {justReset && (
          <div style={{ background: "var(--afa-success-bg)", border: "1px solid #68D391", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "var(--afa-green-dark)" }}>
            {tr.loginPage.passwordUpdatedBanner}
          </div>
        )}
        {wasSuspended && (
          <div style={{ background: "var(--afa-terracotta-tint)", border: "1px solid var(--afa-terracotta)", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "var(--afa-terracotta)" }}>
            {tr.authCommon.accountSuspendedMessage}
          </div>
        )}
        {wasIdle && !wasSuspended && (
          <div style={{ background: "var(--afa-cream)", border: "1px solid rgba(14,12,10,0.15)", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "var(--afa-ink)" }}>
            {tr.loginPage.signedOutIdleBanner}
          </div>
        )}
        {error && (
          <div style={{ background: "var(--afa-terracotta-tint)", border: "1px solid var(--afa-terracotta)", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "var(--afa-terracotta)" }}>
            {error}
          </div>
        )}
        {devOtp && mode === "otp-verify" && (
          <div style={{ background: "var(--afa-amber-tint)", border: "1px solid var(--afa-terracotta)", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "var(--afa-ink)" }}>
            QA Mode — dev OTP: <strong>{devOtp}</strong> (never shown in production)
          </div>
        )}

        {mode !== "otp-verify" && (
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--afa-ink)", opacity: 0.7, display: "block", marginBottom: "6px" }}>
              {tr.loginPage.identifierLabel}
            </label>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={tr.loginPage.identifierPlaceholder}
              onKeyDown={(e) => e.key === "Enter" && mode === "password" && handleLogin()}
              style={{ width: "100%", padding: "12px 14px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.15)", fontSize: "14px", color: "var(--afa-ink)", background: "white", outline: "none", boxSizing: "border-box" }}
            />
          </div>
        )}

        {mode === "password" && (
          <>
            <div style={{ marginBottom: "24px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--afa-ink)", opacity: 0.7, display: "block", marginBottom: "6px" }}>
                {tr.loginPage.passwordLabel}
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={tr.loginPage.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  style={{ width: "100%", padding: "12px 14px", paddingRight: "44px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.15)", fontSize: "14px", color: "var(--afa-ink)", background: "white", outline: "none", boxSizing: "border-box" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? tr.authCommon.hidePassword : tr.authCommon.showPassword}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px", opacity: 0.5, lineHeight: 1 }}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
            <button
              onClick={handleLogin}
              disabled={loading || !identifier || !password}
              style={{ width: "100%", background: "var(--afa-terracotta)", color: "white", padding: "16px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}
            >
              {loading ? tr.loginPage.signingInEllipsis : tr.loginPage.signInButton}
            </button>
            <button
              onClick={() => { setMode("otp-request"); setError("") }}
              style={{ width: "100%", background: "transparent", color: "var(--afa-terracotta)", padding: "12px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 500, cursor: "pointer", marginTop: "8px" }}
            >
              {tr.loginPage.useOtpInstead}
            </button>
          </>
        )}

        {mode === "otp-request" && (
          <>
            <button
              onClick={handleRequestOtp}
              disabled={loading || !identifier}
              style={{ width: "100%", background: "var(--afa-terracotta)", color: "white", padding: "16px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}
            >
              {loading ? tr.loginPage.sendingEllipsis : tr.loginPage.sendCodeButton}
            </button>
            <button
              onClick={() => { setMode("password"); setError("") }}
              style={{ width: "100%", background: "transparent", color: "var(--afa-terracotta)", padding: "12px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 500, cursor: "pointer", marginTop: "8px" }}
            >
              {tr.loginPage.usePasswordInstead}
            </button>
          </>
        )}

        {mode === "otp-verify" && (
          <>
            <div style={{ marginBottom: "24px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--afa-ink)", opacity: 0.7, display: "block", marginBottom: "6px" }}>
                {tr.loginPage.enterCodeLabel}
              </label>
              <input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                maxLength={6}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                style={{ width: "100%", padding: "12px 14px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.15)", fontSize: "14px", color: "var(--afa-ink)", background: "white", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <button
              onClick={handleVerifyOtp}
              disabled={loading || otpCode.length !== 6}
              style={{ width: "100%", background: "var(--afa-terracotta)", color: "white", padding: "16px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}
            >
              {loading ? tr.loginPage.verifyingEllipsis : tr.loginPage.verifyAndSignInButton}
            </button>
            <button
              onClick={handleRequestOtp}
              disabled={loading}
              style={{ width: "100%", background: "transparent", color: "var(--afa-terracotta)", padding: "12px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 500, cursor: "pointer", marginTop: "8px" }}
            >
              {tr.loginPage.resendCodeButton}
            </button>
          </>
        )}

        <div style={{ textAlign: "center", marginTop: "16px" }}>
          <Link href="/forgot-password" style={{ fontSize: "13px", color: "var(--afa-terracotta)", textDecoration: "none" }}>
            {tr.loginPage.forgotPasswordLink}
          </Link>
        </div>
      </div>

      <p style={{ textAlign: "center", marginTop: "24px", fontSize: "14px", color: "var(--afa-ink)", opacity: 0.6 }}>
        {tr.loginPage.noAccountPrefix}{" "}
        <Link href="/register" style={{ color: "var(--afa-terracotta)", textDecoration: "none", fontWeight: 500 }}>
          {tr.loginPage.createOneFreeLink}
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[var(--afa-cream)] flex items-center justify-center px-4 py-10 sm:px-6 sm:py-16 font-sans">
      <Suspense fallback={<BrandLoader />}>
        <LoginForm />
      </Suspense>
    </main>
  )
}
