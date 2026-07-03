"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

const roles = [
  { id: "AUDIENCE", icon: "👥", title: "Audience", desc: "Discover & book live art events" },
  { id: "ARTIST", icon: "🎤", title: "Artist", desc: "Comedian, poet or musician" },
  { id: "ORGANISER", icon: "🎪", title: "Organiser", desc: "Create & manage events" },
  { id: "VENUE_OWNER", icon: "🏛️", title: "Venue Owner", desc: "List your space for events" },
]

export default function RegisterForm({ initialRole }: { initialRole?: string }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [selectedRole, setSelectedRole] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" })

  useEffect(() => {
    const normalizedRole = initialRole?.toUpperCase()
    const validRoles = ["AUDIENCE", "ARTIST", "ORGANISER", "VENUE_OWNER"]
    if (normalizedRole && validRoles.includes(normalizedRole)) {
      setSelectedRole(normalizedRole)
    }
  }, [initialRole])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleRegister = async () => {
    if (form.password !== form.confirm) {
      setError("Passwords do not match!"); return
    }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, role: selectedRole })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Something went wrong"); setLoading(false); return }
      router.push("/login?registered=true")
    } catch {
      setError("Something went wrong"); setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#F7F3EE", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "520px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <Link href="/" style={{ fontFamily: "Georgia, serif", fontSize: "28px", fontWeight: 700, color: "#0E0C0A", textDecoration: "none" }}>
            <span style={{ color: "#C8441A" }}>A</span>forAudience
          </Link>
          <p style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.5, marginTop: "8px" }}>
            {step === 1 ? "Choose how you want to join" : "Create your account"}
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "32px" }}>
          {[1, 2].map((s) => (
            <div key={s} style={{ flex: 1, height: "3px", borderRadius: "99px", background: step >= s ? "#C8441A" : "rgba(14,12,10,0.1)" }} />
          ))}
        </div>

        <div style={{ background: "white", borderRadius: "16px", padding: "40px", border: "1px solid rgba(14,12,10,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          {step === 1 && (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "#0E0C0A", marginBottom: "24px" }}>
                I am a...
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "32px" }}>
                {roles.map((role) => (
                  <div
                    key={role.id}
                    onClick={() => setSelectedRole(role.id)}
                    style={{
                      border: `2px solid ${selectedRole === role.id ? "#C8441A" : "rgba(14,12,10,0.1)"}`,
                      borderRadius: "12px", padding: "20px 16px", cursor: "pointer",
                      background: selectedRole === role.id ? "#FFF5F2" : "white",
                      transition: "all 0.15s"
                    }}
                  >
                    <div style={{ fontSize: "32px", marginBottom: "8px" }}>{role.icon}</div>
                    <div style={{ fontFamily: "Georgia, serif", fontSize: "16px", fontWeight: 700, color: "#0E0C0A", marginBottom: "4px" }}>{role.title}</div>
                    <div style={{ fontSize: "12px", color: "#0E0C0A", opacity: 0.55 }}>{role.desc}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => selectedRole && setStep(2)}
                disabled={!selectedRole}
                style={{ width: "100%", background: selectedRole ? "#C8441A" : "rgba(14,12,10,0.1)", color: selectedRole ? "white" : "rgba(14,12,10,0.3)", padding: "16px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: 600, cursor: selectedRole ? "pointer" : "not-allowed" }}
              >
                Continue →
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <button onClick={() => setStep(1)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "#C8441A", marginBottom: "20px", padding: 0 }}>
                ← Back
              </button>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "#0E0C0A", marginBottom: "24px" }}>
                Your details
              </h2>

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
                      style={{ width: "100%", padding: "12px 14px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.15)", fontSize: "14px", color: "#0E0C0A", background: "white", outline: "none", boxSizing: "border-box" }}
                    />
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
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "14px", color: "#0E0C0A", opacity: 0.6 }}>
          Already have an account? {" "}
          <Link href="/login" style={{ color: "#C8441A", textDecoration: "none", fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>
    </main>
  )
}
