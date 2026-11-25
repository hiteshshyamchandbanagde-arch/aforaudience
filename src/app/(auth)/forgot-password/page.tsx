"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import EnvBadge from "@/components/EnvBadge"
import AuthLayout from "@/components/AuthLayout"
import Button from "@/components/ui/Button"
import { useLocale } from "@/lib/i18n/translate"

export default function ForgotPasswordPage() {
  const { t: tr } = useLocale()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")
  // BUG-2609-063 - same as login: don't disable on empty state (autofill
  // may not have fired onChange yet); read the DOM value on submit.
  const emailRef = useRef<HTMLInputElement>(null)
  const [emailInvalid, setEmailInvalid] = useState(false)

  const handleSubmit = async () => {
    if (loading) return
    const value = (emailRef.current?.value ?? email).trim()
    setEmail(value)
    if (!value) {
      setError(tr.authCommon.enterEmail); setEmailInvalid(true); emailRef.current?.focus()
      return
    }
    setLoading(true)
    setError("")
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value.toLowerCase() }),
      })
      // Always show the same confirmation, regardless of the response -
      // the API itself never reveals whether the email exists.
      setSubmitted(true)
    } catch {
      setError(tr.forgotPasswordPage.somethingWentWrongRetry)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-8">
          <Link href="/" className="text-[length:var(--afa-text-page-title)] font-bold text-[color:var(--afa-text-primary)] no-underline lg:hidden" style={{ fontFamily: "var(--font-display)" }}>
            <span className="text-[color:var(--afa-brand-mark)]">A</span>forAudience
            <EnvBadge />
          </Link>
          <p className="text-[length:var(--afa-text-body)] text-[color:var(--afa-text-primary)] opacity-50 mt-2">
            {tr.forgotPasswordPage.resetYourPasswordSubtitle}
          </p>
        </div>

        <div className="bg-[var(--afa-surface-raised)] rounded-[var(--afa-radius-xl)] p-8 sm:p-10 border border-[var(--afa-tint-08)] shadow-[0_8px_32px_-4px_var(--afa-shadow)]">
          {submitted ? (
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--afa-text-subheading)", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "var(--afa-space-3)" }}>
                {tr.forgotPasswordPage.checkYourEmailHeading}
              </h2>
              <p style={{ fontSize: "var(--afa-text-body)", color: "var(--afa-text-primary)", opacity: 0.7, lineHeight: 1.6 }}>
                {tr.forgotPasswordPage.ifAccountExistsPrefix} <strong>{email}</strong>{tr.forgotPasswordPage.ifAccountExistsSuffix}
              </p>
              <p style={{ fontSize: "var(--afa-text-ui)", color: "var(--afa-text-primary)", opacity: 0.5, lineHeight: 1.6, marginTop: "var(--afa-space-4)" }}>
                {tr.forgotPasswordPage.didntGetAnything}
              </p>
            </div>
          ) : (
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--afa-text-subheading)", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "var(--afa-space-3)" }}>
                {tr.forgotPasswordPage.forgotPasswordHeading}
              </h2>
              <p style={{ fontSize: "var(--afa-text-body)", color: "var(--afa-text-primary)", opacity: 0.6, marginBottom: "var(--afa-space-5)" }}>
                {tr.forgotPasswordPage.enterEmailIntro}
              </p>

              {error && (
                <div style={{ background: "var(--afa-error-tint)", border: "1px solid var(--afa-error-edge)", borderRadius: "var(--afa-radius-md)", padding: "var(--afa-space-3) var(--afa-space-4)", marginBottom: "var(--afa-space-5)", fontSize: "var(--afa-text-body)", color: "var(--afa-error-bright)" }}>
                  {error}
                </div>
              )}

              <label style={{ fontSize: "var(--afa-text-ui)", fontWeight: 500, color: "var(--afa-text-primary)", opacity: 0.7, display: "block", marginBottom: "var(--afa-space-6px)" }}>
                {tr.registerPage.emailLabel}
              </label>
              <input
                ref={emailRef}
                type="email"
                name="email"
                autoComplete="email"
                aria-invalid={emailInvalid || undefined}
                placeholder={tr.registerPage.emailPlaceholder}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailInvalid(false) }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                style={{ width: "100%", padding: "var(--afa-space-3) var(--afa-space-14px)", borderRadius: "var(--afa-radius-md)", border: "1.5px solid var(--afa-tint-12)", fontSize: "var(--afa-text-body)", color: "var(--afa-text-primary)", background: "transparent", outline: "none", boxSizing: "border-box" }}
              />

              <Button
                variant="form-submit"
                onClick={handleSubmit}
                disabled={loading}
                style={{ marginTop: "var(--afa-space-5)" }}
              >
                {loading ? tr.loginPage.sendingEllipsis : tr.forgotPasswordPage.sendResetLinkButton}
              </Button>
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: "var(--afa-space-6)", fontSize: "var(--afa-text-body)" }}>
          <Link href="/login" style={{ color: "var(--afa-amber)", textDecoration: "none", fontWeight: 500 }}>
            {tr.forgotPasswordPage.backToSignIn}
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
