"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import EnvBadge from "@/components/EnvBadge"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""
  const [form, setForm] = useState({ password: "", confirm: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  // Same eye-toggle pattern as register (PR #62) and login, applied here
  // too for consistency across every password-entry field in the app.
  const [visible, setVisible] = useState({ password: false, confirm: false })

  const handleSubmit = async () => {
    if (!token) {
      setError("This reset link is invalid or has expired.")
      return
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match!")
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
        setError(data.error || "Something went wrong")
        setLoading(false)
        return
      }

      router.push("/login?reset=true")
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-[440px]">
      <div className="text-center mb-8">
       <Link href="/" className="font-serif text-[28px] font-bold text-[var(--afa-ink)] no-underline">
          <span className="text-[var(--afa-terracotta)]">A</span>forAudience
          <EnvBadge />
        </Link>
        <p className="text-[14px] text-[var(--afa-ink)] opacity-50 mt-2">
          Choose a new password
        </p>
      </div>

      <div className="bg-white rounded-[16px] p-8 sm:p-10 border border-[rgba(14,12,10,0.08)] shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        {!token ? (
          <p style={{ fontSize: "14px", color: "var(--afa-terracotta)" }}>
            This reset link is invalid or has expired. <Link href="/forgot-password" style={{ color: "var(--afa-terracotta)", fontWeight: 500 }}>Request a new one</Link>.
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
                { label: "New password", name: "password", placeholder: "Min 8 characters" },
                { label: "Confirm new password", name: "confirm", placeholder: "Repeat password" },
              ].map((field) => (
                <div key={field.name}>
                  <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--afa-ink)", opacity: 0.7, display: "block", marginBottom: "6px" }}>
                    {field.label}
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={visible[field.name as keyof typeof visible] ? "text" : "password"}
                      placeholder={field.placeholder}
                      value={form[field.name as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      style={{ width: "100%", padding: "12px 14px", paddingRight: "44px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.15)", fontSize: "14px", color: "var(--afa-ink)", background: "white", outline: "none", boxSizing: "border-box" }}
                    />
                    <button
                      type="button"
                      onClick={() => setVisible({ ...visible, [field.name]: !visible[field.name as keyof typeof visible] })}
                      aria-label={visible[field.name as keyof typeof visible] ? "Hide password" : "Show password"}
                      style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px", opacity: 0.5, lineHeight: 1 }}
                    >
                      {visible[field.name as keyof typeof visible] ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{ width: "100%", background: "var(--afa-terracotta)", color: "white", padding: "16px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}
            >
              {loading ? "Updating..." : "Update password"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[var(--afa-cream)] flex items-center justify-center px-4 py-10 sm:px-6 sm:py-16 font-sans">
      <Suspense fallback={<div>Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  )
}
