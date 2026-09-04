"use client"

import { useState } from "react"
import Link from "next/link"
import EnvBadge from "@/components/EnvBadge"
import AuthLayout from "@/components/AuthLayout"
import { useLocale } from "@/lib/i18n/translate"

export default function ForgotPasswordPage() {
  const { t: tr } = useLocale()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    setLoading(true)
    setError("")
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
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
          <Link href="/" className="font-serif text-[28px] font-bold text-[var(--afa-text-primary)] no-underline lg:hidden">
            <span className="text-[var(--afa-brand-mark)]">A</span>forAudience
            <EnvBadge />
          </Link>
          <p className="text-[14px] text-[var(--afa-text-primary)] opacity-50 mt-2">
            {tr.forgotPasswordPage.resetYourPasswordSubtitle}
          </p>
        </div>

        <div className="bg-[var(--afa-surface-raised)] rounded-[16px] p-8 sm:p-10 border border-[rgba(245,245,240,0.08)] shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35)]">
          {submitted ? (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "12px" }}>
                {tr.forgotPasswordPage.checkYourEmailHeading}
              </h2>
              <p style={{ fontSize: "14px", color: "var(--afa-text-primary)", opacity: 0.7, lineHeight: 1.6 }}>
                {tr.forgotPasswordPage.ifAccountExistsPrefix} <strong>{email}</strong>{tr.forgotPasswordPage.ifAccountExistsSuffix}
              </p>
              <p style={{ fontSize: "13px", color: "var(--afa-text-primary)", opacity: 0.5, lineHeight: 1.6, marginTop: "16px" }}>
                {tr.forgotPasswordPage.didntGetAnything}
              </p>
            </div>
          ) : (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "12px" }}>
                {tr.forgotPasswordPage.forgotPasswordHeading}
              </h2>
              <p style={{ fontSize: "14px", color: "var(--afa-text-primary)", opacity: 0.6, marginBottom: "20px" }}>
                {tr.forgotPasswordPage.enterEmailIntro}
              </p>

              {error && (
                <div style={{ background: "var(--afa-terracotta-tint)", border: "1px solid var(--afa-terracotta)", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "var(--afa-terracotta)" }}>
                  {error}
                </div>
              )}

              <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--afa-text-primary)", opacity: 0.7, display: "block", marginBottom: "6px" }}>
                {tr.registerPage.emailLabel}
              </label>
              <input
                type="email"
                placeholder={tr.registerPage.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                style={{ width: "100%", padding: "12px 14px", borderRadius: "8px", border: "1.5px solid rgba(245,245,240,0.12)", fontSize: "14px", color: "var(--afa-text-primary)", background: "transparent", outline: "none", boxSizing: "border-box" }}
              />

              <button
                onClick={handleSubmit}
                disabled={loading || !email}
                style={{ width: "100%", background: "var(--afa-fill-solid)", color: "white", padding: "16px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer", marginTop: "20px" }}
              >
                {loading ? tr.loginPage.sendingEllipsis : tr.forgotPasswordPage.sendResetLinkButton}
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "14px" }}>
          <Link href="/login" style={{ color: "var(--afa-amber)", textDecoration: "none", fontWeight: 500 }}>
            {tr.forgotPasswordPage.backToSignIn}
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
