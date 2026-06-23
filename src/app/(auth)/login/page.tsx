"use client"
import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const registered = searchParams.get("registered")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({ email: "", password: "" })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleLogin = async () => {
    setLoading(true); setError("")
    try {
      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      })
      if (result?.error) {
        setError("Invalid email or password")
        setLoading(false); return
      }
      router.push("/")
    } catch {
      setError("Something went wrong")
      setLoading(false)
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: "440px" }}>
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <Link href="/" style={{ fontFamily: "Georgia, serif", fontSize: "28px", fontWeight: 700, color: "#0E0C0A", textDecoration: "none" }}>
          <span style={{ color: "#C8441A" }}>A</span>forAudience
        </Link>
        <p style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.5, marginTop: "8px" }}>
          Welcome back to the art world
        </p>
      </div>

      <div style={{ background: "white", borderRadius: "16px", padding: "40px", border: "1px solid rgba(14,12,10,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "#0E0C0A", marginBottom: "24px" }}>
          Sign in
        </h2>

        {registered && (
          <div style={{ background: "#F0FFF4", border: "1px solid #68D391", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "#276749" }}>
            ✅ Account created! Please sign in.
          </div>
        )}

        {error && (
          <div style={{ background: "#FFF5F2", border: "1px solid #C8441A", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "#C8441A" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
          {[
            { label: "Email", name: "email", type: "email", placeholder: "you@example.com" },
            { label: "Password", name: "password", type: "password", placeholder: "Your password" },
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
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                style={{ width: "100%", padding: "12px 14px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.15)", fontSize: "14px", color: "#0E0C0A", background: "white", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{ width: "100%", background: "#C8441A", color: "white", padding: "16px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div style={{ textAlign: "center", marginTop: "16px" }}>
          <Link href="#" style={{ fontSize: "13px", color: "#C8441A", textDecoration: "none" }}>
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
    <main style={{ minHeight: "100vh", background: "#F7F3EE", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
      <Suspense fallback={<div>Loading...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  )
}