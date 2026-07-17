"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import EnvBadge from "@/components/EnvBadge"

const inputStyle = (hasError?: boolean) => ({
  width: "100%",
  padding: "12px 14px",
  borderRadius: "8px",
  border: `1.5px solid ${hasError ? "#C8441A" : "rgba(14,12,10,0.15)"}`,
  fontSize: "14px",
  color: "#0E0C0A",
  background: "white",
  outline: "none",
  boxSizing: "border-box" as const,
})

const labelStyle = { fontSize: "13px", fontWeight: 500, color: "#0E0C0A", opacity: 0.7, display: "block", marginBottom: "6px" }

export default function RegisterForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string; username?: string }>({})
  const [form, setForm] = useState({ fullName: "", username: "", email: "", phoneNumber: "", password: "", confirm: "" })

  const [usernameTouched, setUsernameTouched] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle")
  const [usernameSuggestion, setUsernameSuggestion] = useState<string | null>(null)

  // Feedback widget request (cmrlxz35q): let users verify what they typed
  // before submitting, for both the password and confirm-password fields
  // independently.
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Auto-suggest username from Full Name, until the user edits it themselves.
  // Full Name itself IS also sent to the server (as displayName) and shows
  // up on tickets/emails; only the username gets sliced/lowercased here.
  useEffect(() => {
    if (!usernameTouched && form.fullName) {
      const suggested = form.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20)
      setForm((f) => ({ ...f, username: suggested }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.fullName, usernameTouched])

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
    if (name === "username") setUsernameTouched(true)
    setForm({ ...form, [name]: value })
    setFieldErrors({ ...fieldErrors, [name]: undefined })
  }

  const handleRegister = async () => {
    if (form.password !== form.confirm) {
      setError("Passwords do not match!"); return
    }
    if (usernameStatus === "taken") {
      setError("Please choose an available username."); return
    }
    if (!/^\d{10}$/.test(form.phoneNumber)) {
      setFieldErrors({ phone: "Enter a valid 10-digit mobile number" }); return
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
        const normalizedError = String(data.error || "Something went wrong")
        if (normalizedError.toLowerCase().includes("email")) {
          setFieldErrors({ email: normalizedError })
        } else if (normalizedError.toLowerCase().includes("phone")) {
          setFieldErrors({ phone: normalizedError })
        } else if (normalizedError.toLowerCase().includes("username")) {
          setFieldErrors({ username: normalizedError })
        } else {
          setError(normalizedError)
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
      setError("Something went wrong")
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
        setError(data.error || "Invalid code.")
        setLoading(false)
        return
      }
      router.push("/login?registered=true")
    } catch {
      setError("Something went wrong")
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
        setError(data.error || "Could not resend code.")
        setLoading(false)
        return
      }
      setDevOtp(data.devOtp ?? null)
      setLoading(false)
    } catch {
      setError("Could not resend code.")
      setLoading(false)
    }
  }

  if (stage === "otp") {
    return (
      <main style={{ minHeight: "100vh", background: "#F7F3EE", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ width: "100%", maxWidth: "480px" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <Link href="/" style={{ fontFamily: "Georgia, serif", fontSize: "28px", fontWeight: 700, color: "#0E0C0A", textDecoration: "none" }}>
              <span style={{ color: "#C8441A" }}>A</span>forAudience
              <EnvBadge />
            </Link>
            <p style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.5, marginTop: "8px" }}>
              Verify your mobile number
            </p>
          </div>

          <div style={{ background: "white", borderRadius: "16px", padding: "40px", border: "1px solid rgba(14,12,10,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
            {devOtp && (
              <div style={{ background: "#FFF8E1", border: "1px solid #C8441A", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "#0E0C0A" }}>
                QA Mode — dev OTP: <strong>{devOtp}</strong> (never shown in production)
              </div>
            )}
            {error && (
              <div style={{ background: "#FFF5F2", border: "1px solid #C8441A", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "#C8441A" }}>
                {error}
              </div>
            )}

            <label style={labelStyle}>Enter 6-digit code sent to {fullPhone}</label>
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
              style={{ width: "100%", background: "#C8441A", color: "white", padding: "16px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
            <button
              onClick={handleResendOtp}
              disabled={loading}
              style={{ width: "100%", background: "transparent", color: "#C8441A", padding: "12px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 500, cursor: "pointer", marginTop: "8px" }}
            >
              Resend code
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: "100vh", background: "#F7F3EE", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "480px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <Link href="/" style={{ fontFamily: "Georgia, serif", fontSize: "28px", fontWeight: 700, color: "#0E0C0A", textDecoration: "none" }}>
            <span style={{ color: "#C8441A" }}>A</span>forAudience
            <EnvBadge />
          </Link>
          <p style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.5, marginTop: "8px" }}>
            Create your account
          </p>
        </div>

        <div style={{ background: "white", borderRadius: "16px", padding: "40px", border: "1px solid rgba(14,12,10,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          {error && (
            <div style={{ background: "#FFF5F2", border: "1px solid #C8441A", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "#C8441A" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                name="fullName"
                type="text"
                placeholder="Your full name"
                value={form.fullName}
                onChange={handleChange}
                style={inputStyle()}
              />
            </div>

            <div>
              <label style={labelStyle}>Username</label>
              <input
                name="username"
                type="text"
                placeholder="Auto-suggested from your name — edit if you like"
                value={form.username}
                onChange={handleChange}
                style={inputStyle(!!fieldErrors.username || usernameStatus === "taken")}
              />
              {usernameStatus === "checking" && (
                <p style={{ marginTop: "6px", fontSize: "12px", color: "#0E0C0A", opacity: 0.5 }}>Checking availability...</p>
              )}
              {usernameStatus === "available" && (
                <p style={{ marginTop: "6px", fontSize: "12px", color: "#276749" }}>Available</p>
              )}
              {usernameStatus === "taken" && (
                <p style={{ marginTop: "6px", fontSize: "12px", color: "#C8441A" }}>
                  Taken.{" "}
                  {usernameSuggestion && (
                    <button
                      type="button"
                      onClick={() => { setUsernameTouched(true); setForm((f) => ({ ...f, username: usernameSuggestion })) }}
                      style={{ color: "#C8441A", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontSize: "12px", padding: 0 }}
                    >
                      Use &quot;{usernameSuggestion}&quot; instead
                    </button>
                  )}
                </p>
              )}
              {fieldErrors.username && (
                <p style={{ marginTop: "8px", fontSize: "13px", color: "#C8441A" }}>{fieldErrors.username}</p>
              )}
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                style={inputStyle(!!fieldErrors.email)}
              />
              {fieldErrors.email && (
                <p style={{ marginTop: "8px", fontSize: "13px", color: "#C8441A" }}>{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label style={labelStyle}>Mobile number</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ padding: "12px 14px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.15)", fontSize: "14px", color: "#0E0C0A", background: "#F7F3EE" }}>
                  +91
                </div>
                <input
                  name="phoneNumber"
                  type="tel"
                  placeholder="10-digit number"
                  value={form.phoneNumber}
                  onChange={handleChange}
                  style={{ ...inputStyle(!!fieldErrors.phone), flex: 1 }}
                />
              </div>
              <p style={{ marginTop: "6px", fontSize: "12px", color: "#0E0C0A", opacity: 0.45 }}>
                Used to verify your account with a one-time code.
              </p>
              {fieldErrors.phone && (
                <p style={{ marginTop: "8px", fontSize: "13px", color: "#C8441A" }}>{fieldErrors.phone}</p>
              )}
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 8 characters"
                  value={form.password}
                  onChange={handleChange}
                  style={{ ...inputStyle(), paddingRight: "44px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px", opacity: 0.5, lineHeight: 1 }}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <div style={{ position: "relative" }}>
                <input
                  name="confirm"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat password"
                  value={form.confirm}
                  onChange={handleChange}
                  style={{ ...inputStyle(), paddingRight: "44px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px", opacity: 0.5, lineHeight: 1 }}
                >
                  {showConfirm ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleRegister}
            disabled={loading || usernameStatus === "taken"}
            style={{ width: "100%", background: "#C8441A", color: "white", padding: "16px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer", marginTop: "24px" }}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </div>

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "14px", color: "#0E0C0A", opacity: 0.6 }}>
          Already have an account? {" "}
          <Link href="/login" style={{ color: "#C8441A", textDecoration: "none", fontWeight: 500 }}>Sign in</Link>
        </p>
        <p style={{ textAlign: "center", marginTop: "12px", fontSize: "13px", color: "#0E0C0A", opacity: 0.45 }}>
          Everyone joins as Audience. You can apply to become an Artist, Organiser, or Venue Owner later from your profile.
        </p>
      </div>
    </main>
  )
}
