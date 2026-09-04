"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import EnvBadge from "@/components/EnvBadge"
import { useLocale } from "@/lib/i18n/translate"

const inputStyle = (hasError?: boolean) => ({
  width: "100%",
  padding: "12px 14px",
  borderRadius: "8px",
  border: `1.5px solid ${hasError ? "var(--afa-terracotta)" : "rgba(245,245,240,0.15)"}`,
  fontSize: "14px",
  color: "var(--afa-ink)",
  background: "white",
  outline: "none",
  boxSizing: "border-box" as const,
})

const labelStyle = { fontSize: "13px", fontWeight: 500, color: "var(--afa-ink)", opacity: 0.7, display: "block", marginBottom: "6px" }

export default function RegisterForm() {
  const router = useRouter()
  const { t: tr } = useLocale()
  // Feedback cmrzsmlus - landing page "Join As" links now pass ?role=X so
  // the person's original intent survives past registration instead of
  // dropping them on the generic homepage with no memory of why they came.
  const searchParams = useSearchParams()
  const intendedRole = searchParams.get("role")
  // GEN-2608-037: the subtitle below stayed generic ("Create your
  // account") regardless of which "Join As X" link brought someone here -
  // no visible acknowledgment that the click did anything, even though
  // intendedRole was already being captured and carried through to
  // /profile (Hitesh, live click-test). Maps the URL value to the same
  // role labels already used in the footer links themselves.
  const intendedRoleLabel: string | null =
    intendedRole === "artist" ? tr.roles.ARTIST :
    intendedRole === "organiser" ? tr.roles.ORGANISER :
    intendedRole === "venue" ? tr.roles.VENUE_OWNER :
    null
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string; username?: string }>({})
  const [form, setForm] = useState({ fullName: "", username: "", email: "", phoneNumber: "", password: "", confirm: "" })

  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle")
  const [usernameSuggestion, setUsernameSuggestion] = useState<string | null>(null)

  // Feedback widget request (cmrlxz35q): let users verify what they typed
  // before submitting, for both the password and confirm-password fields
  // independently.
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Previously auto-suggested a username derived from Full Name
  // ("Will Smith" -> "willsmith") until the user edited it themselves.
  // Removed (Feedback cmrxoaeun, session 39) - silently baking someone's
  // real name into a system identifier, even one that's never shown
  // publicly, was flagged as a real privacy concern for a performer who
  // may not want any part of the platform tying their legal name to an
  // identifier at all.
  //
  // Middle ground (Feedback cmse195bc1e27d60e27596011, session 63):
  // Hitesh asked for the blank-field gap to be closed but the privacy
  // reasoning above still holds, so this suggests from INITIALS only
  // ("Will Smith" -> "ws"), never the name itself - genuinely
  // de-identified, not just visually shortened. And unlike the old
  // behavior, it's never auto-filled: same "click to accept" pattern as
  // the existing taken-username suggestion below, so the person still
  // deliberately chooses it rather than it silently appearing.
  //
  // Upgrade (2 Aug, same Feedback thread): a single flat initials string
  // read as a bare-minimum effort, so this now fetches up to 3 varied
  // options (plain / numbered / brand-flavored) from
  // suggestUsernameVariants, plus a "try more" reroll.
  const [initialsSuggestions, setInitialsSuggestions] = useState<string[]>([])
  const [initialsLoading, setInitialsLoading] = useState(false)

  const initialsSeed = (() => {
    if (form.username || !form.fullName.trim()) return ""
    const words = form.fullName.trim().split(/\s+/).filter(Boolean)
    const seed = words.length > 1 ? words.map((w) => w[0]).join("") : words[0]?.slice(0, 3) ?? ""
    return seed.length >= 2 ? seed : ""
  })()

  const fetchInitialsSuggestions = async (seed: string) => {
    setInitialsLoading(true)
    try {
      const res = await fetch(`/api/auth/username-suggestions?seed=${encodeURIComponent(seed)}`)
      const data = await res.json()
      setInitialsSuggestions(data.variants ?? [])
    } catch {
      setInitialsSuggestions([])
    } finally {
      setInitialsLoading(false)
    }
  }

  useEffect(() => {
    if (!initialsSeed) {
      setInitialsSuggestions([])
      return
    }
    const timeout = setTimeout(() => fetchInitialsSuggestions(initialsSeed), 500)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialsSeed])

  // Live uniqueness check, debounced.
  useEffect(() => {
    if (!form.username) {
      setUsernameStatus("idle")
      return
    }
    setUsernameStatus("checking")
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/username-check?value=${encodeURIComponent(form.username)}`)
        const data = await res.json()
        if (data.available) {
          setUsernameStatus("available")
          setUsernameSuggestion(null)
        } else {
          setUsernameStatus("taken")
          setUsernameSuggestion(data.suggestion ?? null)
        }
      } catch {
        setUsernameStatus("idle")
      }
    }, 400)
    return () => clearTimeout(timeout)
  }, [form.username])

  // ---- Stage 2: phone OTP verification, shown after successful register ----
  const [stage, setStage] = useState<"form" | "otp">("form")
  const [userId, setUserId] = useState<string | null>(null)
  const [fullPhone, setFullPhone] = useState<string | null>(null)
  const [otpCode, setOtpCode] = useState("")
  const [devOtp, setDevOtp] = useState<string | null>(null) // only ever set in QA

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
    setFieldErrors({ ...fieldErrors, [name]: undefined })
  }

  const handleRegister = async () => {
    if (form.password !== form.confirm) {
      setError(tr.registerPage.passwordsDontMatch); return
    }
    if (usernameStatus === "taken") {
      setError(tr.registerPage.pleaseChooseAvailableUsername); return
    }
    if (!/^\d{10}$/.test(form.phoneNumber)) {
      setFieldErrors({ phone: tr.registerPage.invalidPhoneNumber }); return
    }

    setLoading(true)
    setError("")
    setFieldErrors({})

    const phone = `+91${form.phoneNumber}`

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          username: form.username,
          email: form.email,
          phone,
          password: form.password,
        })
      })
      const data = await res.json()

      if (!res.ok) {
        // `code` is a stable identifier the server returns alongside the
        // (English) `error` string - look up the translated message instead
        // of displaying raw English (BUG-2608-038). `field` names which
        // input the error belongs to, replacing the old English-keyword
        // sniffing that broke once messages could render in Hindi.
        const code = typeof data.code === "string" ? data.code : undefined
        const authErrors = tr.authErrors as Record<string, string>
        const translatedError =
          (code && authErrors[code]) || String(data.error || tr.authCommon.somethingWentWrong)
        const field = typeof data.field === "string" ? data.field : undefined

        if (field === "email") {
          setFieldErrors({ email: translatedError })
        } else if (field === "phone") {
          setFieldErrors({ phone: translatedError })
        } else if (field === "username") {
          setFieldErrors({ username: translatedError })
        } else {
          setError(translatedError)
        }
        setLoading(false)
        return
      }

      setUserId(data.userId)
      setFullPhone(data.phone ?? phone)
      setDevOtp(data.devOtp ?? null)
      setStage("otp")
      setLoading(false)
    } catch {
      setError(tr.authCommon.somethingWentWrong)
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, userId, code: otpCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || tr.registerPage.invalidCodeFallback)
        setLoading(false)
        return
      }
      router.push(`/login?registered=true${intendedRole ? `&role=${intendedRole}` : ""}`)
    } catch {
      setError(tr.authCommon.somethingWentWrong)
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "SIGNUP_VERIFY", phone: fullPhone }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || tr.registerPage.couldNotResendCodeFallback)
        setLoading(false)
        return
      }
      setDevOtp(data.devOtp ?? null)
      setLoading(false)
    } catch {
      setError(tr.registerPage.couldNotResendCodeFallback)
      setLoading(false)
    }
  }

  if (stage === "otp") {
    return (
      <main style={{ minHeight: "100vh", background: "var(--afa-surface-raised)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ width: "100%", maxWidth: "480px" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <Link href="/" style={{ fontFamily: "Georgia, serif", fontSize: "28px", fontWeight: 700, color: "var(--afa-text-primary)", textDecoration: "none" }}>
              <span style={{ color: "var(--afa-brand-mark)" }}>A</span>forAudience
              <EnvBadge />
            </Link>
            <p style={{ fontSize: "14px", color: "var(--afa-text-primary)", opacity: 0.5, marginTop: "8px" }}>
              {tr.registerPage.verifyMobileSubtitle}
            </p>
          </div>

          <div style={{ background: "white", borderRadius: "16px", padding: "40px", border: "1px solid rgba(245,245,240,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
            {devOtp && (
              <div style={{ background: "var(--afa-amber-tint)", border: "1px solid var(--afa-terracotta)", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "var(--afa-ink)" }}>
                QA Mode — dev OTP: <strong>{devOtp}</strong> (never shown in production)
              </div>
            )}
            {error && (
              <div style={{ background: "var(--afa-terracotta-tint)", border: "1px solid var(--afa-terracotta)", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "var(--afa-terracotta)" }}>
                {error}
              </div>
            )}

            <label style={labelStyle}>{tr.registerPage.enterCodeLabelTemplate.replace('{phone}', fullPhone ?? '')}</label>
            <input
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              maxLength={6}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
              style={{ ...inputStyle(), marginBottom: "20px" }}
            />

            <button
              onClick={handleVerifyOtp}
              disabled={loading || otpCode.length !== 6}
              style={{ width: "100%", background: "var(--afa-terracotta)", color: "white", padding: "16px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}
            >
              {loading ? tr.loginPage.verifyingEllipsis : tr.registerPage.verifyButton}
            </button>
            <button
              onClick={handleResendOtp}
              disabled={loading}
              style={{ width: "100%", background: "transparent", color: "var(--afa-terracotta)", padding: "12px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 500, cursor: "pointer", marginTop: "8px" }}
            >
              {tr.loginPage.resendCodeButton}
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-surface-raised)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "480px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <Link href="/" style={{ fontFamily: "Georgia, serif", fontSize: "28px", fontWeight: 700, color: "var(--afa-text-primary)", textDecoration: "none" }}>
            <span style={{ color: "var(--afa-brand-mark)" }}>A</span>forAudience
            <EnvBadge />
          </Link>
          <p style={{ fontSize: "14px", color: "var(--afa-text-primary)", opacity: 0.5, marginTop: "8px" }}>
            {intendedRoleLabel
              ? tr.registerPage.createAccountSubtitleForRoleTemplate.replace('{role}', intendedRoleLabel)
              : tr.registerPage.createAccountSubtitle}
          </p>
        </div>

        <div style={{ background: "white", borderRadius: "16px", padding: "40px", border: "1px solid rgba(245,245,240,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          {error && (
            <div style={{ background: "var(--afa-terracotta-tint)", border: "1px solid var(--afa-terracotta)", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "var(--afa-terracotta)" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={labelStyle}>{tr.registerPage.fullNameLabel}</label>
              <input
                name="fullName"
                type="text"
                placeholder={tr.registerPage.fullNamePlaceholder}
                value={form.fullName}
                onChange={handleChange}
                style={inputStyle()}
              />
            </div>

            <div>
              <label style={labelStyle}>{tr.registerPage.usernameLabel}</label>
              <input
                name="username"
                type="text"
                placeholder={tr.registerPage.usernamePlaceholder}
                value={form.username}
                onChange={handleChange}
                style={inputStyle(!!fieldErrors.username || usernameStatus === "taken")}
              />
              {usernameStatus === "idle" && initialsSuggestions.length > 0 && (
                <div style={{ marginTop: "8px" }}>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--afa-ink)", opacity: 0.6 }}>
                    {tr.registerPage.suggestedFromInitials}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px", alignItems: "center" }}>
                    {initialsSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, username: suggestion }))}
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "var(--afa-terracotta)",
                          background: "rgba(196,90,52,0.08)",
                          border: "1px solid rgba(196,90,52,0.25)",
                          borderRadius: "999px",
                          padding: "4px 12px",
                          cursor: "pointer",
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => fetchInitialsSuggestions(initialsSeed)}
                      disabled={initialsLoading}
                      title={tr.registerPage.tryMoreSuggestionsTitle}
                      style={{
                        fontSize: "12px",
                        color: "var(--afa-ink)",
                        opacity: initialsLoading ? 0.4 : 0.6,
                        background: "none",
                        border: "none",
                        cursor: initialsLoading ? "default" : "pointer",
                        padding: "4px 2px",
                      }}
                    >
                      {initialsLoading ? "…" : tr.registerPage.tryMoreButton}
                    </button>
                  </div>
                </div>
              )}
              {usernameStatus === "checking" && (
                <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--afa-ink)", opacity: 0.5 }}>{tr.registerPage.checkingAvailability}</p>
              )}
              {usernameStatus === "available" && (
                <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--afa-green-dark)" }}>{tr.registerPage.availableLabel}</p>
              )}
              {usernameStatus === "taken" && (
                <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--afa-terracotta)" }}>
                  {tr.registerPage.takenLabel}{" "}
                  {usernameSuggestion && (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, username: usernameSuggestion }))}
                      style={{ color: "var(--afa-terracotta)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontSize: "12px", padding: 0 }}
                    >
                      {tr.registerPage.useInsteadTemplate.replace('{username}', usernameSuggestion)}
                    </button>
                  )}
                </p>
              )}
              {fieldErrors.username && (
                <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--afa-terracotta)" }}>{fieldErrors.username}</p>
              )}
            </div>

            <div>
              <label style={labelStyle}>{tr.registerPage.emailLabel}</label>
              <input
                name="email"
                type="email"
                placeholder={tr.registerPage.emailPlaceholder}
                value={form.email}
                onChange={handleChange}
                style={inputStyle(!!fieldErrors.email)}
              />
              {fieldErrors.email && (
                <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--afa-terracotta)" }}>{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label style={labelStyle}>{tr.registerPage.mobileNumberLabel}</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ padding: "12px 14px", borderRadius: "8px", border: "1.5px solid rgba(245,245,240,0.15)", fontSize: "14px", color: "var(--afa-text-primary)", background: "var(--afa-surface-raised)" }}>
                  +91
                </div>
                <input
                  name="phoneNumber"
                  type="tel"
                  placeholder={tr.registerPage.tenDigitPlaceholder}
                  value={form.phoneNumber}
                  onChange={handleChange}
                  style={{ ...inputStyle(!!fieldErrors.phone), flex: 1 }}
                />
              </div>
              <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--afa-ink)", opacity: 0.45 }}>
                {tr.registerPage.otpHint}
              </p>
              {fieldErrors.phone && (
                <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--afa-terracotta)" }}>{fieldErrors.phone}</p>
              )}
            </div>

            <div>
              <label style={labelStyle}>{tr.loginPage.passwordLabel}</label>
              <div style={{ position: "relative" }}>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={tr.registerPage.minCharsPlaceholder}
                  value={form.password}
                  onChange={handleChange}
                  style={{ ...inputStyle(), paddingRight: "44px" }}
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
            <div>
              <label style={labelStyle}>{tr.registerPage.confirmPasswordLabel}</label>
              <div style={{ position: "relative" }}>
                <input
                  name="confirm"
                  type={showConfirm ? "text" : "password"}
                  placeholder={tr.registerPage.repeatPasswordPlaceholder}
                  value={form.confirm}
                  onChange={handleChange}
                  style={{ ...inputStyle(), paddingRight: "44px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? tr.authCommon.hidePassword : tr.authCommon.showPassword}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px", opacity: 0.5, lineHeight: 1 }}
                >
                  {showConfirm ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
          </div>

          {/* GEN-2608-038: reinforces intent right at the commit point
              (Hitesh's suggestion, live-testing) instead of only at the
              top of the form. Deliberately non-interactive and phrased as
              "you'll complete your application after this step" - every
              registration creates an AUDIENCE account regardless of
              intendedRole (see route.ts), so this must never read as a
              choice of account type. Reuses intendedRoleLabel from the
              subtitle above (#415); only renders when a role param was
              recognized. */}
          {intendedRoleLabel && (
            <p style={{ textAlign: "center", marginTop: "20px", marginBottom: "-8px", fontSize: "13px", color: "var(--afa-ink)", opacity: 0.65 }}>
              {tr.registerPage.roleConfirmationTemplate.replace('{role}', intendedRoleLabel)}
            </p>
          )}

          <button
            onClick={handleRegister}
            disabled={loading || usernameStatus === "taken"}
            style={{ width: "100%", background: "var(--afa-terracotta)", color: "white", padding: "16px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer", marginTop: "24px" }}
          >
            {loading ? tr.registerPage.creatingAccountEllipsis : tr.registerPage.createAccountButton}
          </button>
          <p style={{ textAlign: "center", marginTop: "14px", fontSize: "12px", color: "var(--afa-ink)", opacity: 0.5 }}>
            {tr.registerPage.agreeToTermsPrefix}{" "}
            <Link href="/terms" style={{ color: "var(--afa-terracotta)", textDecoration: "none" }}>{tr.registerPage.termsOfServiceLink}</Link> {tr.registerPage.andConjunction}{" "}
            <Link href="/privacy" style={{ color: "var(--afa-terracotta)", textDecoration: "none" }}>{tr.registerPage.privacyPolicyLink}</Link>.
          </p>
        </div>

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "14px", color: "var(--afa-text-primary)", opacity: 0.6 }}>
          {tr.registerPage.alreadyHaveAccountPrefix} {" "}
          <Link href="/login" style={{ color: "var(--afa-terracotta)", textDecoration: "none", fontWeight: 500 }}>{tr.registerPage.signInLink}</Link>
        </p>
        <p style={{ textAlign: "center", marginTop: "12px", fontSize: "13px", color: "var(--afa-text-primary)", opacity: 0.45 }}>
          {tr.registerPage.everyoneJoinsAsAudience}
        </p>
      </div>
    </main>
  )
}
