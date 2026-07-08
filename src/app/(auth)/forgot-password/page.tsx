"use client"

import { useState } from "react"
import Link from "next/link"

export default function ForgotPasswordPage() {
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
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F3EE] flex items-center justify-center px-4 py-10 sm:px-6 sm:py-16 font-sans">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-8">
          <Link href="/" className="font-serif text-[28px] font-bold text-[#0E0C0A] no-underline">
            <span className="text-[#C8441A]">A</span>forAudience
          </Link>
          <p className="text-[14px] text-[#0E0C0A] opacity-50 mt-2">
            Reset your password
          </p>
        </div>

        <div className="bg-white rounded-[16px] p-8 sm:p-10 border border-[rgba(14,12,10,0.08)] shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          {submitted ? (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#0E0C0A", marginBottom: "12px" }}>
                Check your email
              </h2>
              <p style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.7, lineHeight: 1.6 }}>
                If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to reset your password. It expires in 1 hour.
              </p>
            </div>
          ) : (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#0E0C0A", marginBottom: "12px" }}>
                Forgot your password?
              </h2>
              <p style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.6, marginBottom: "20px" }}>
                Enter your email and we&apos;ll send you a reset link.
              </p>

              {error && (
                <div style={{ background: "#FFF5F2", border: "1px solid #C8441A", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "#C8441A" }}>
                  {error}
                </div>
              )}

              <label style={{ fontSize: "13px", fontWeight: 500, color: "#0E0C0A", opacity: 0.7, display: "block", marginBottom: "6px" }}>
                Email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                style={{ width: "100%", padding: "12px 14px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.15)", fontSize: "14px", color: "#0E0C0A", background: "white", outline: "none", boxSizing: "border-box" }}
              />

              <button
                onClick={handleSubmit}
                disabled={loading || !email}
                style={{ width: "100%", background: "#C8441A", color: "white", padding: "16px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer", marginTop: "20px" }}
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "14px", color: "#0E0C0A", opacity: 0.6 }}>
          <Link href="/login" style={{ color: "#C8441A", textDecoration: "none", fontWeight: 500 }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
