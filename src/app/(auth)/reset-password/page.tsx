"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import EnvBadge from "@/components/EnvBadge"
import BrandLoader from '@/components/BrandLoader'
import { useLocale } from "@/lib/i18n/translate"

// Auth Pages Dark Theme Redesign (4 Sep 2026, docs/design.md) - same
// two-path eye outline as RegisterForm.tsx, re-skinning the 🙈/👁️ emoji.
function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.59 21.59 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a21.59 21.59 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t: tr } = useLocale()
  const token = searchParams.get("token") || ""
  const [form, setForm] = useState({ password: "", confirm: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  // Same eye-toggle pattern as register (PR #62) and login, applied here
  // too for consistency across every password-entry field in the app.
  const [visible, setVisible] = useState({ password: false, confirm: false })

  const handleSubmit = async () => {
    if (!token) {
      setError(tr.resetPasswordPage.resetLinkInvalidOrExpired)
      return
    }
    if (form.password !== form.confirm) {
      setError(tr.registerPage.passwordsDontMatch)
      return
    }

    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: form.password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || tr.authCommon.somethingWentWrong)
        setLoading(false)
        return
      }

      router.push("/login?reset=true")
    } catch {
      setError(tr.forgotPasswordPage.somethingWentWrongRetry)
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-[440px]">
      <div className="text-center mb-8">
       <Link href="/" className="font-serif text-[28px] font-bold text-[var(--afa-text-primary)] no-underline">
          <span className="text-[var(--afa-brand-mark)]">A</span>forAudience
          <EnvBadge />
        </Link>
        <p className="text-[14px] text-[var(--afa-text-primary)] opacity-50 mt-2">
          {tr.resetPasswordPage.chooseNewPasswordSubtitle}
        </p>
      </div>

      <div className="bg-[var(--afa-surface-raised)] rounded-[16px] p-8 sm:p-10 border border-[rgba(245,245,240,0.08)] shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35)]">
        {!token ? (
          <p style={{ fontSize: "14px", color: "var(--afa-error)" }}>
            {tr.resetPasswordPage.resetLinkInvalidOrExpired} <Link href="/forgot-password" style={{ color: "var(--afa-amber)", fontWeight: 500 }}>{tr.resetPasswordPage.requestNewOneLink}</Link>.
          </p>
        ) : (
          <>
            {error && (
              <div style={{ background: "var(--afa-terracotta-tint)", border: "1px solid var(--afa-terracotta)", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "var(--afa-terracotta)" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
              {[
                { label: tr.resetPasswordPage.newPasswordLabel, name: "password", placeholder: tr.registerPage.minCharsPlaceholder },
                { label: tr.resetPasswordPage.confirmNewPasswordLabel, name: "confirm", placeholder: tr.registerPage.repeatPasswordPlaceholder },
              ].map((field) => (
                <div key={field.name}>
                  <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--afa-text-primary)", opacity: 0.7, display: "block", marginBottom: "6px" }}>
                    {field.label}
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={visible[field.name as keyof typeof visible] ? "text" : "password"}
                      placeholder={field.placeholder}
                      value={form[field.name as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      style={{ width: "100%", padding: "12px 14px", paddingRight: "44px", borderRadius: "8px", border: "1.5px solid rgba(245,245,240,0.12)", fontSize: "14px", color: "var(--afa-text-primary)", background: "transparent", outline: "none", boxSizing: "border-box" }}
                    />
                    <button
                      type="button"
                      onClick={() => setVisible({ ...visible, [field.name]: !visible[field.name as keyof typeof visible] })}
                      aria-label={visible[field.name as keyof typeof visible] ? tr.authCommon.hidePassword : tr.authCommon.showPassword}
                      style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "4px", opacity: 0.5, lineHeight: 1, color: "var(--afa-text-primary)", display: "flex" }}
                    >
                      <EyeIcon visible={visible[field.name as keyof typeof visible]} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{ width: "100%", background: "var(--afa-fill-solid)", color: "white", padding: "16px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}
            >
              {loading ? tr.resetPasswordPage.updatingEllipsis : tr.resetPasswordPage.updatePasswordButton}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[var(--afa-surface-page)] flex items-center justify-center px-4 py-10 sm:px-6 sm:py-16 font-sans">
      <Suspense fallback={<BrandLoader />}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  )
}
