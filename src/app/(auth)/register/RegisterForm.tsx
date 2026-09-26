"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import EnvBadge from "@/components/EnvBadge"
import { useLocale } from "@/lib/i18n/translate"
import Button from "@/components/ui/Button"
import { FILL_SOLID_TINT, FILL_SOLID_BORDER_TINT } from "@/lib/statusStyle"
import { isValidUsernameFormat } from "@/lib/validation"

const inputStyle = (hasError?: boolean) => ({
  width: "100%",
  padding: "var(--afa-space-3) var(--afa-space-14px)",
  borderRadius: "var(--afa-radius-md)",
  border: `1.5px solid ${hasError ? "var(--afa-error)" : "rgba(245,245,240,0.12)"}`,
  fontSize: "var(--afa-text-body)",
  color: "var(--afa-text-primary)",
  background: "transparent",
  outline: "none",
  boxSizing: "border-box" as const,
})

const labelStyle = { fontSize: "var(--afa-text-ui)", fontWeight: 500, color: "var(--afa-text-primary)", opacity: 0.7, display: "block", marginBottom: "var(--afa-space-6px)" }

// Auth Pages Dark Theme Redesign (4 Sep 2026, docs/design.md) - simple
// two-path eye outline replacing the 🙈/👁️ emoji, per Figma. Re-skin only;
// the show/hide state and onClick logic it sits inside is unchanged.
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

function CheckCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ display: "inline-block", verticalAlign: "-2px", marginRight: "var(--afa-space-1)" }} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="var(--afa-green-dark)" />
      <path d="M7 12.5l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.68-3.88 2.68-6.62z"/>{/* token-ok: Google brand logo, fixed official 4-color palette, cannot be tokenized */}
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z"/>{/* token-ok: Google brand logo, fixed official 4-color palette, cannot be tokenized */}
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33z"/>{/* token-ok: Google brand logo, fixed official 4-color palette, cannot be tokenized */}
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58z"/>{/* token-ok: Google brand logo, fixed official 4-color palette, cannot be tokenized */}
    </svg>
  )
}

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

  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle")
  const [usernameSuggestion, setUsernameSuggestion] = useState<string | null>(null)

  // Feedback widget request (cmrlxz35q): let users verify what they typed
  // before submitting, for both the password and confirm-password fields
  // independently.
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Auth Pages Dark Theme Redesign (4 Sep 2026, docs/design.md) - real
  // strength heuristic (length + character-variety), not just the static
  // 3-segment visual Figma shows. Weak: anything below the medium bar.
  // Medium: 8+ chars and 2+ of {lower/upper/digit/symbol}. Strong: 10+
  // chars and 3+ varieties.
  const passwordStrength = (() => {
    const pw = form.password
    if (!pw) return 0
    const variety = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length
    if (pw.length >= 10 && variety >= 3) return 3
    if (pw.length >= 8 && variety >= 2) return 2
    return 1
  })()
  const strengthColor =
    passwordStrength === 3 ? "var(--afa-green-dark)" :
    passwordStrength === 2 ? "var(--afa-amber)" :
    passwordStrength === 1 ? "var(--afa-error)" :
    "rgba(245,245,240,0.12)"
  const strengthLabel =
    passwordStrength === 3 ? tr.registerPage.passwordStrengthStrong :
    passwordStrength === 2 ? tr.registerPage.passwordStrengthMedium :
    passwordStrength === 1 ? tr.registerPage.passwordStrengthWeak :
    ""

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
    // BUG-2609-054 - same rule as the server; don't ask about availability
    // for a name that can't be registered at all.
    if (!isValidUsernameFormat(form.username.trim())) {
      setUsernameStatus("invalid")
      setUsernameSuggestion(null)
      return
    }
    setUsernameStatus("checking")
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/username-check?value=${encodeURIComponent(form.username)}`)
        const data = await res.json()
        if (data.invalid) {
          setUsernameStatus("invalid")
          setUsernameSuggestion(null)
        } else if (data.available) {
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
    if (usernameStatus === "invalid") {
      setFieldErrors({ username: tr.authErrors.USERNAME_INVALID }); return
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
          intendedRole,
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
        <div style={{ width: "100%", maxWidth: "480px" }}>
          <div style={{ textAlign: "center", marginBottom: "var(--afa-space-32px)" }}>
            <Link href="/" className="lg:hidden" style={{ fontFamily: "var(--font-display)", fontSize: "var(--afa-text-page-title)", fontWeight: 700, color: "var(--afa-text-primary)", textDecoration: "none" }}>
              <span style={{ color: "var(--afa-brand-mark)" }}>A</span>forAudience
              <EnvBadge />
            </Link>
            <p style={{ fontSize: "var(--afa-text-body)", color: "var(--afa-text-primary)", opacity: 0.5, marginTop: "var(--afa-space-2)" }}>
              {tr.registerPage.verifyMobileSubtitle}
            </p>
          </div>

          <div style={{ background: "var(--afa-surface-raised)", borderRadius: "var(--afa-radius-xl)", padding: "40px", border: "1px solid var(--afa-tint-08)", boxShadow: "0 8px 32px -4px rgba(0,0,0,0.35)" }}>
            {devOtp && (
              <div style={{ background: "rgba(201,151,58,0.15)", border: "1px solid var(--afa-amber)", borderRadius: "var(--afa-radius-md)", padding: "var(--afa-space-3) var(--afa-space-4)", marginBottom: "var(--afa-space-5)", fontSize: "var(--afa-text-ui)", color: "var(--afa-text-primary)" }}>
                QA Mode — dev OTP: <strong>{devOtp}</strong> (never shown in production)
              </div>
            )}
            {error && (
              <div style={{ background: "rgba(179,38,30,0.1)", border: "1px solid rgba(179,38,30,0.3)", borderRadius: "var(--afa-radius-md)", padding: "var(--afa-space-3) var(--afa-space-4)", marginBottom: "var(--afa-space-5)", fontSize: "var(--afa-text-body)", color: "var(--afa-error)" }}>
                {error}
              </div>
            )}

            <label style={labelStyle}>{tr.registerPage.enterCodeLabelTemplate.replace('{phone}', fullPhone ?? '')}</label>
            <input
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              maxLength={6}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
              style={{ ...inputStyle(), marginBottom: "var(--afa-space-5)" }}
            />

            <Button
              variant="form-submit"
              onClick={handleVerifyOtp}
              disabled={loading || otpCode.length !== 6}
            >
              {loading ? tr.loginPage.verifyingEllipsis : tr.registerPage.verifyButton}
            </Button>
            <Button
              variant="link"
              onClick={handleResendOtp}
              disabled={loading}
              style={{ marginTop: "var(--afa-space-2)", opacity: 1 }}
            >
              {tr.loginPage.resendCodeButton}
            </Button>
          </div>
        </div>
    )
  }

  return (
      <div style={{ width: "100%", maxWidth: "480px" }}>
        <div style={{ textAlign: "center", marginBottom: "var(--afa-space-32px)" }}>
          <Link href="/" className="lg:hidden" style={{ fontFamily: "var(--font-display)", fontSize: "var(--afa-text-page-title)", fontWeight: 700, color: "var(--afa-text-primary)", textDecoration: "none" }}>
            <span style={{ color: "var(--afa-brand-mark)" }}>A</span>forAudience
            <EnvBadge />
          </Link>
          <p style={{ fontSize: "var(--afa-text-body)", color: "var(--afa-text-primary)", opacity: 0.5, marginTop: "var(--afa-space-2)" }}>
            {intendedRoleLabel
              ? tr.registerPage.createAccountSubtitleForRoleTemplate.replace('{role}', intendedRoleLabel)
              : tr.registerPage.createAccountSubtitle}
          </p>
        </div>

        <div style={{ background: "var(--afa-surface-raised)", borderRadius: "var(--afa-radius-xl)", padding: "40px", border: "1px solid var(--afa-tint-08)", boxShadow: "0 8px 32px -4px rgba(0,0,0,0.35)" }}>
          {/* Auth Pages Dark Theme Redesign (4 Sep 2026) - new, above Full
              Name per docs/design.md. QST-2607-009 backend is merged so the
              call is wired for real, but it only actually completes once
              Hitesh finishes the OAuth redirect URI + test users setup in
              Google Cloud Console - same env gate as Login's button. */}
          {process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === "true" && (
            <>
              <Button
                variant="outline-neutral"
                size="lg"
                type="button"
                onClick={() => signIn("google", { callbackUrl: intendedRole ? `/profile?role=${intendedRole}` : "/" })}
              >
                <GoogleIcon />
                {tr.loginPage.continueWithGoogle}
              </Button>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--afa-space-3)", margin: "var(--afa-space-5) 0" }}>
                <div style={{ flex: 1, height: "1px", background: "rgba(245,245,240,0.12)" }} />
                <span style={{ fontSize: "var(--afa-text-small)", color: "var(--afa-text-primary)", opacity: 0.5, textTransform: "uppercase" }}>{tr.loginPage.orDivider}</span>
                <div style={{ flex: 1, height: "1px", background: "rgba(245,245,240,0.12)" }} />
              </div>
            </>
          )}

          {error && (
            <div style={{ background: "rgba(179,38,30,0.1)", border: "1px solid rgba(179,38,30,0.3)", borderRadius: "var(--afa-radius-md)", padding: "var(--afa-space-3) var(--afa-space-4)", marginBottom: "var(--afa-space-5)", fontSize: "var(--afa-text-body)", color: "var(--afa-error)" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--afa-space-4)" }}>
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
                autoComplete="username"
                placeholder={tr.registerPage.usernamePlaceholder}
                value={form.username}
                onChange={handleChange}
                style={inputStyle(!!fieldErrors.username || usernameStatus === "taken" || usernameStatus === "invalid")}
              />
              {usernameStatus === "idle" && initialsSuggestions.length > 0 && (
                <div style={{ marginTop: "var(--afa-space-2)" }}>
                  <p style={{ margin: 0, fontSize: "var(--afa-text-small)", color: "var(--afa-text-primary)", opacity: 0.6 }}>
                    {tr.registerPage.suggestedFromInitials}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--afa-space-2)", marginTop: "var(--afa-space-6px)", alignItems: "center" }}>
                    {/* GEN-2609-096 - left raw deliberately: a translucent-tint
                        utility chip (GEN-2609-066 precedent), the same
                        architectural pattern as statusStyle.ts's selection
                        pills, not a Button-shaped CTA. */}
                    {initialsSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, username: suggestion }))}
                        style={{
                          fontSize: "var(--afa-text-small)",
                          fontWeight: 600,
                          color: "var(--afa-fill-solid)",
                          background: FILL_SOLID_TINT,
                          border: `1px solid ${FILL_SOLID_BORDER_TINT}`,
                          borderRadius: "var(--afa-radius-pill)",
                          padding: "var(--afa-space-1) var(--afa-space-3)",
                          cursor: "pointer",
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                    <Button
                      variant="bare"
                      type="button"
                      onClick={() => fetchInitialsSuggestions(initialsSeed)}
                      disabled={initialsLoading}
                      title={tr.registerPage.tryMoreSuggestionsTitle}
                      style={{
                        fontSize: "var(--afa-text-small)",
                        color: "var(--afa-text-primary)",
                        opacity: initialsLoading ? 0.4 : 0.6,
                        cursor: initialsLoading ? "default" : "pointer",
                        padding: "var(--afa-space-1) var(--afa-space-2px)",
                      }}
                    >
                      {initialsLoading ? "…" : tr.registerPage.tryMoreButton}
                    </Button>
                  </div>
                </div>
              )}
              {usernameStatus === "checking" && (
                <p style={{ marginTop: "var(--afa-space-6px)", fontSize: "var(--afa-text-small)", color: "var(--afa-text-primary)", opacity: 0.5 }}>{tr.registerPage.checkingAvailability}</p>
              )}
              {usernameStatus === "available" && (
                <p style={{ marginTop: "var(--afa-space-6px)", fontSize: "var(--afa-text-small)", color: "var(--afa-green-dark)", display: "flex", alignItems: "center" }}>
                  <CheckCircleIcon />{tr.registerPage.availableLabel}
                </p>
              )}
              {usernameStatus === "invalid" && !fieldErrors.username && (
                <p style={{ marginTop: "var(--afa-space-6px)", fontSize: "var(--afa-text-small)", color: "var(--afa-error)" }}>
                  {tr.authErrors.USERNAME_INVALID}
                </p>
              )}
              {usernameStatus === "taken" && (
                <p style={{ marginTop: "var(--afa-space-6px)", fontSize: "var(--afa-text-small)", color: "var(--afa-error)" }}>
                  {tr.registerPage.takenLabel}{" "}
                  {usernameSuggestion && (
                    <Button
                      variant="bare"
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, username: usernameSuggestion }))}
                      style={{ color: "var(--afa-error)", textDecoration: "underline", fontSize: "var(--afa-text-small)", padding: 0 }}
                    >
                      {tr.registerPage.useInsteadTemplate.replace('{username}', usernameSuggestion)}
                    </Button>
                  )}
                </p>
              )}
              {fieldErrors.username && (
                <p style={{ marginTop: "var(--afa-space-2)", fontSize: "var(--afa-text-ui)", color: "var(--afa-error)" }}>{fieldErrors.username}</p>
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
                <p style={{ marginTop: "var(--afa-space-2)", fontSize: "var(--afa-text-ui)", color: "var(--afa-error)" }}>{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label style={labelStyle}>{tr.registerPage.mobileNumberLabel}</label>
              {/* Auth Pages Dark Theme Redesign (4 Sep 2026) - unified
                  bordered container replacing the old two-separate-boxes
                  look; +91 prefix and the number input now share one
                  border with an internal divider, per Figma. */}
              <div style={{ display: "flex", alignItems: "stretch", border: `1.5px solid ${fieldErrors.phone ? "var(--afa-error)" : "rgba(245,245,240,0.12)"}`, borderRadius: "var(--afa-radius-md)", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", padding: "0 var(--afa-space-14px)", fontSize: "var(--afa-text-body)", color: "var(--afa-text-primary)", opacity: 0.7, borderRight: "1px solid rgba(245,245,240,0.12)" }}>
                  +91
                </div>
                <input
                  name="phoneNumber"
                  type="tel"
                  placeholder={tr.registerPage.tenDigitPlaceholder}
                  value={form.phoneNumber}
                  onChange={handleChange}
                  style={{ flex: 1, minWidth: 0, padding: "var(--afa-space-3) var(--afa-space-14px)", border: "none", background: "transparent", color: "var(--afa-text-primary)", fontSize: "var(--afa-text-body)", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <p style={{ marginTop: "var(--afa-space-6px)", fontSize: "var(--afa-text-small)", color: "var(--afa-text-primary)", opacity: 0.45 }}>
                {tr.registerPage.otpHint}
              </p>
              {fieldErrors.phone && (
                <p style={{ marginTop: "var(--afa-space-2)", fontSize: "var(--afa-text-ui)", color: "var(--afa-error)" }}>{fieldErrors.phone}</p>
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
                <Button
                  variant="icon"
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? tr.authCommon.hidePassword : tr.authCommon.showPassword}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", padding: "var(--afa-space-1)", opacity: 0.5, lineHeight: 1, color: "var(--afa-text-primary)" }}
                >
                  <EyeIcon visible={showPassword} />
                </Button>
              </div>
              {/* Auth Pages Dark Theme Redesign (4 Sep 2026) - real
                  length + character-variety strength meter (passwordStrength
                  above), not a static visual. */}
              {form.password.length > 0 && (
                <div style={{ marginTop: "var(--afa-space-2)" }}>
                  <div style={{ display: "flex", gap: "var(--afa-space-1)" }}>
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: "4px",
                          borderRadius: "var(--afa-radius-xs)",
                          background: i < passwordStrength ? strengthColor : "rgba(245,245,240,0.12)",
                        }}
                      />
                    ))}
                  </div>
                  <p style={{ marginTop: "var(--afa-space-1)", fontSize: "var(--afa-text-micro)", color: strengthColor }}>
                    {strengthLabel}
                  </p>
                </div>
              )}
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
                <Button
                  variant="icon"
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? tr.authCommon.hidePassword : tr.authCommon.showPassword}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", padding: "var(--afa-space-1)", opacity: 0.5, lineHeight: 1, color: "var(--afa-text-primary)" }}
                >
                  <EyeIcon visible={showConfirm} />
                </Button>
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
            <p style={{ textAlign: "center", marginTop: "var(--afa-space-5)", marginBottom: "-8px", fontSize: "var(--afa-text-ui)", color: "var(--afa-text-primary)", opacity: 0.65 }}>
              {tr.registerPage.roleConfirmationTemplate.replace('{role}', intendedRoleLabel)}
            </p>
          )}

          <Button
            variant="form-submit"
            onClick={handleRegister}
            disabled={loading || usernameStatus === "taken" || usernameStatus === "invalid"}
            style={{ marginTop: "var(--afa-space-6)" }}
          >
            {loading ? tr.registerPage.creatingAccountEllipsis : tr.registerPage.createAccountButton}
          </Button>
          <p style={{ textAlign: "center", marginTop: "var(--afa-space-14px)", fontSize: "var(--afa-text-small)" }}>
            <span style={{ color: "var(--afa-text-primary)", opacity: 0.5 }}>{tr.registerPage.agreeToTermsPrefix}</span>{" "}
            <Link href="/terms" style={{ color: "var(--afa-amber)", textDecoration: "none" }}>{tr.registerPage.termsOfServiceLink}</Link> <span style={{ color: "var(--afa-text-primary)", opacity: 0.5 }}>{tr.registerPage.andConjunction}</span>{" "}
            <Link href="/privacy" style={{ color: "var(--afa-amber)", textDecoration: "none" }}>{tr.registerPage.privacyPolicyLink}</Link><span style={{ color: "var(--afa-text-primary)", opacity: 0.5 }}>.</span>
          </p>
        </div>

        <p style={{ textAlign: "center", marginTop: "var(--afa-space-6)", fontSize: "var(--afa-text-body)" }}>
          <span style={{ color: "var(--afa-text-primary)", opacity: 0.6 }}>{tr.registerPage.alreadyHaveAccountPrefix}</span> {" "}
          <Link href="/login" style={{ color: "var(--afa-amber)", textDecoration: "none", fontWeight: 500 }}>{tr.registerPage.signInLink}</Link>
        </p>
        <p style={{ textAlign: "center", marginTop: "var(--afa-space-3)", fontSize: "var(--afa-text-ui)", color: "var(--afa-text-primary)", opacity: 0.45 }}>
          {tr.registerPage.everyoneJoinsAsAudience}
        </p>
      </div>
  )
}
