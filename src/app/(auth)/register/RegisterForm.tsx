"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function RegisterForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string }>({})
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setFieldErrors({ ...fieldErrors, [e.target.name]: undefined })
  }

  const handleRegister = async () => {
    if (form.password !== form.confirm) {
      setError("Passwords do not match!"); return
    }

    setLoading(true)
    setError("")
    setFieldErrors({})

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      })
      const data = await res.json()

      if (!res.ok) {
        const normalizedError = String(data.error || "Something went wrong")

        if (normalizedError.toLowerCase().includes("email")) {
          setFieldErrors({ email: normalizedError })
        } else if (normalizedError.toLowerCase().includes("phone")) {
          setFieldErrors({ phone: normalizedError })
        } else {
          setError(normalizedError)
        }

        setLoading(false)
        return
      }

      router.push("/login?registered=true")
    } catch {
      setError("Something went wrong")
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#F7F3EE", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "480px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <Link href="/" style={{ fontFamily: "Georgia, serif", fontSize: "28px", fontWeight: 700, color: "#0E0C0A", textDecoration: "none" }}>
            <span style={{ color: "#C8441A" }}>A</span>forAudience
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
            {[
              { label: "Full Name", name: "name", type: "text", placeholder: "Your full name" },
              { label: "Email", name: "email", type: "email", placeholder: "you@example.com" },
              { label: "Phone", name: "phone", type: "tel", placeholder: "+91 98765 43210" },
              { label: "Password", name: "password", type: "password", placeholder: "Min 8 characters" },
              { label: "Confirm Password", name: "confirm", type: "password", placeholder: "Repeat password" },
            ].map((field) => (
              <div key={field.name}>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "#0E0C0A", opacity: 0.7, display: "block", marginBottom: "6px" }}>
                  {field.label}
                </label>
                <input
                  name={field.name}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={form[field.name as keyof typeof form]}
                  onChange={handleChange}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: `1.5px solid ${fieldErrors[field.name as keyof typeof fieldErrors] ? "#C8441A" : "rgba(14,12,10,0.15)"}`,
                    fontSize: "14px",
                    color: "#0E0C0A",
                    background: "white",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
                {fieldErrors[field.name as keyof typeof fieldErrors] && (
                  <p style={{ marginTop: "8px", fontSize: "13px", color: "#C8441A" }}>
                    {fieldErrors[field.name as keyof typeof fieldErrors]}
                  </p>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={handleRegister}
            disabled={loading}
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
