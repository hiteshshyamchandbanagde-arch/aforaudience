"use client"
import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import EnvBadge from "@/components/EnvBadge"

type Mode = "password" | "otp-request" | "otp-verify"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const registered = searchParams.get("registered")
  const justReset = searchParams.get("reset")
  const wasSuspended = searchParams.get("suspended")
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
          setError("Too many attempts. Try again in 15 minutes.")
        } else if (result.error === "SUSPENDED") {
          setError("Your account has been suspended. Contact support if you believe this is a mistake.")
        } else if (result.error === "CredentialsSignin") {
          setError("Invalid credentials")
        } else {
          setError("Failed to sign in. Please check your credentials.")
        }
        setLoading(false); return
      }
      router.push("/")
    } catch {
      setError("Something went wrong")
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
        setError(data.error || "Could not send code.")
        setLoading(false); return
      }
      setDevOtp(data.devOtp ?? null)
      setMode("otp-verify")
      setLoading(false)
    } catch {
      setError("Could not send code.")
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
          setError("Your account has been suspended. Contact support if you believe this is a mistake.")
        } else {
          setError("Invalid or expired code.")
        }
        setLoading(false); return
      }
      router.push("/")
    } catch {
      setError("Something went wrong")
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-[440px]">
      <div className="text-center mb-8">
        <Link href="/" className="font-serif text-[28px] font-bold text-[#0E0C0A] no-underline">
          <span className="text-[#C8441A]">A</span>forAudience
          <EnvBadge />
        </Link>
        <p className="text-[14px] text-[#0E0C0A] opacity-50 mt-2">
          Welcome back to the art world
        </p>
      </div>

      <div className="bg-white rounded-[16px] p-8 sm:p-10 border border-[rgba(14,12,10,0.08)] shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "#0E0C0A", marginBottom: "24px" }}>
          Sign in
        </h2>

        {registered && (
          <div style={{ background: "#F0FFF4", border: "1px solid #68D391", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "#276749" }}>
            ✅ Account created! Please sign in.
          </div>
        )}
        {justReset && (
          <div style={{ background: "#F0FFF4", border: "1px solid #68D391", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "#276749" }}>
            ✅ Password updated. Please sign in.
          </div>
        )}
        {wasSuspended && (
          <div style={{ background: "#FFF5F2", border: "1px solid #C8441A", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "#C8441A" }}>
            Your account has been suspended. Contact support if you believe this is a mistake.
          </div>
        )}
        {error && (
          <div style={{ background: "#FFF5F2", border: "1px solid #C8441A", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "#C8441A" }}>
            {error}
          </div>
        )}
        {devOtp && mode === "otp-verify" && (
          <div style={{ background: "#FFF8E1", border: "1px solid #C8441A", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "#0E0C0A" }}>
            QA Mode — dev OTP: <strong>{devOtp}</strong> (never shown in production)
          </div>
        )}

        {mode !== "otp-verify" && (
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "13px", fontWeight: 500, color: "#0E0C0A", opacity: 0.7, display: "block", marginBottom: "6px" }}>
              Email / Phone / Username / Code
            </label>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com, phone, username, or AFA code"
              onKeyDown={(e) => e.key === "Enter" && mode === "password" && handleLogin()}
              style={{ width: "100%", padding: "12px 14px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.15)", fontSize: "14px", color: "#0E0C0A", background: "white", outline: "none", boxSizing: "border-box" }}
            />
          </div>
        )}

        {mode === "password" && (
          <>
            <div style={{ marginBottom: "24px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#0E0C0A", opacity: 0.7, display: "block", marginBottom: "6px" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  style={{ width: "100%", padding: "12px 14px", paddingRight: "44px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.15)", fontSize: "14px", color: "#0E0C0A", background: "white", outline: "none", boxSizing: "border-box" }}
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
            <button
              onClick={handleLogin}
              disabled={loading || !identifier || !password}
              style={{ width: "100%", background: "#C8441A", color: "white", padding: "16px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <button
              onClick={() => { setMode("otp-request"); setError("") }}
              style={{ width: "100%", background: "transparent", color: "#C8441A", padding: "12px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 500, cursor: "pointer", marginTop: "8px" }}
            >
              Use OTP instead
            </button>
          </>
        )}

        {mode === "otp-request" && (
          <>
            <button
              onClick={handleRequestOtp}
              disabled={loading || !identifier}
              style={{ width: "100%", background: "#C8441A", color: "white", padding: "16px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}
            >
              {loading ? "Sending..." : "Send code"}
            </button>
            <button
              onClick={() => { setMode("password"); setError("") }}
              style={{ width: "100%", background: "transparent", color: "#C8441A", padding: "12px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 500, cursor: "pointer", marginTop: "8px" }}
            >
              Use password instead
            </button>
          </>
        )}

        {mode === "otp-verify" && (
          <>
            <div style={{ marginBottom: "24px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#0E0C0A", opacity: 0.7, display: "block", marginBottom: "6px" }}>
                Enter 6-digit code
              </label>
              <input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                maxLength={6}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                style={{ width: "100%", padding: "12px 14px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.15)", fontSize: "14px", color: "#0E0C0A", background: "white", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <button
              onClick={handleVerifyOtp}
              disabled={loading || otpCode.length !== 6}
              style={{ width: "100%", background: "#C8441A", color: "white", padding: "16px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}
            >
              {loading ? "Verifying..." : "Verify & Sign In"}
            </button>
            <button
              onClick={handleRequestOtp}
              disabled={loading}
              style={{ width: "100%", background: "transparent", color: "#C8441A", padding: "12px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 500, cursor: "pointer", marginTop: "8px" }}
            >
              Resend code
            </button>
          </>
        )}

        <div style={{ textAlign: "center", marginTop: "16px" }}>
          <Link href="/forgot-password" style={{ fontSize: "13px", color: "#C8441A", textDecoration: "none" }}>
            Forgot password?
          </Link>
        </div>
      </div>

      <p style={{ textAlign: "center", marginTop: "24px", fontSize: "14px", color: "#0E0C0A", opacity: 0.6 }}>
        Don&apos;t have an account?{" "}
        <Link href="/register" style={{ color: "#C8441A", textDecoration: "none", fontWeight: 500 }}>
          Create one free
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#F7F3EE] flex items-center justify-center px-4 py-10 sm:px-6 sm:py-16 font-sans">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  )
}
