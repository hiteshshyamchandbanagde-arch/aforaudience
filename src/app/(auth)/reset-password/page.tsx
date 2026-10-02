"use client"

import { useState, useRef, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import EnvBadge from "@/components/EnvBadge"
import BrandLoader from '@/components/BrandLoader'
import AuthLayout from '@/components/AuthLayout'
import Button from "@/components/ui/Button"
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
  // BUG-2609-063 - read the DOM values on submit (a password manager can
  // fill these without firing onChange), and say so if one is empty.
  const inputRefs = { password: useRef<HTMLInputElement>(null), confirm: useRef<HTMLInputElement>(null) }

  const handleSubmit = async () => {
    if (loading) return
    const password = inputRefs.password.current?.value ?? form.password
    const confirm = inputRefs.confirm.current?.value ?? form.confirm
    setForm({ password, confirm })
    if (!token) {
      setError(tr.resetPasswordPage.resetLinkInvalidOrExpired)
      return
    }
    if (!password) {
      setError(tr.authCommon.enterNewPassword); inputRefs.password.current?.focus()
      return
    }
    if (password !== confirm) {
      setError(tr.registerPage.passwordsDontMatch)
      return
    }

    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
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
       <Link href="/" className="text-[length:var(--afa-text-page-title)] font-bold text-[color:var(--afa-text-primary)] no-underline lg:hidden" style={{ fontFamily: "var(--font-display)" }}>
          <span className="text-[color:var(--afa-brand-mark)]">A</span>forAudience
          <EnvBadge />
        </Link>
        <p className="text-[length:var(--afa-text-body)] text-[color:var(--afa-text-primary)] opacity-50 mt-2">
          {tr.resetPasswordPage.chooseNewPasswordSubtitle}
        </p>
      </div>

      <div className="bg-[var(--afa-surface-raised)] rounded-[var(--afa-radius-xl)] p-8 sm:p-10 border border-[var(--afa-tint-08)] shadow-[0_8px_32px_-4px_var(--afa-shadow)]">
        {!token ? (
          <p style={{ fontSize: "var(--afa-text-body)", color: "var(--afa-error-bright)" }}>
            {tr.resetPasswordPage.resetLinkInvalidOrExpired} <Link href="/forgot-password" style={{ color: "var(--afa-amber)", fontWeight: 500 }}>{tr.resetPasswordPage.requestNewOneLink}</Link>.
          </p>
        ) : (
          <>
            {error && (
              <div style={{ background: "var(--afa-error-tint)", border: "1px solid var(--afa-error-edge)", borderRadius: "var(--afa-radius-md)", padding: "var(--afa-space-3) var(--afa-space-4)", marginBottom: "var(--afa-space-5)", fontSize: "var(--afa-text-body)", color: "var(--afa-error-bright)" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--afa-space-4)", marginBottom: "var(--afa-space-6)" }}>
              {[
                { label: tr.resetPasswordPage.newPasswordLabel, name: "password", placeholder: tr.registerPage.minCharsPlaceholder },
                { label: tr.resetPasswordPage.confirmNewPasswordLabel, name: "confirm", placeholder: tr.registerPage.repeatPasswordPlaceholder },
              ].map((field) => (
                <div key={field.name}>
                  <label style={{ fontSize: "var(--afa-text-ui)", fontWeight: 500, color: "var(--afa-text-primary)", opacity: 0.7, display: "block", marginBottom: "var(--afa-space-6px)" }}>
                    {field.label}
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      ref={inputRefs[field.name as keyof typeof inputRefs]}
                      autoComplete="new-password"
                      type={visible[field.name as keyof typeof visible] ? "text" : "password"}
                      placeholder={field.placeholder}
                      value={form[field.name as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      style={{ width: "100%", padding: "var(--afa-space-3) var(--afa-space-14px)", paddingRight: "44px", borderRadius: "var(--afa-radius-md)", border: "1.5px solid var(--afa-tint-12)", fontSize: "var(--afa-text-body)", color: "var(--afa-text-primary)", background: "transparent", outline: "none", boxSizing: "border-box" }}
                    />
                    <Button
                      variant="icon"
                      type="button"
                      onClick={() => setVisible({ ...visible, [field.name]: !visible[field.name as keyof typeof visible] })}
                      aria-label={visible[field.name as keyof typeof visible] ? tr.authCommon.hidePassword : tr.authCommon.showPassword}
                      style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", padding: "var(--afa-space-1)", opacity: 0.5, lineHeight: 1, color: "var(--afa-text-primary)" }}
                    >
                      <EyeIcon visible={visible[field.name as keyof typeof visible]} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="form-submit" onClick={handleSubmit} disabled={loading}>
              {loading ? tr.resetPasswordPage.updatingEllipsis : tr.resetPasswordPage.updatePasswordButton}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<BrandLoader />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  )
}
