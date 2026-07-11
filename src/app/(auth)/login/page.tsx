"use client"
import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import EnvBadge from "@/components/EnvBadge"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const registered = searchParams.get("registered")
  const justReset = searchParams.get("reset")
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
        email: form.email.trim().toLowerCase(),
        password: form.password,
        redirect: false,
      })
      if (result?.error) {
        if (result.error === "LOCKED") {
          setError("Too many attempts. Try again in 15 minutes.")
        } else if (result.error === "CredentialsSignin") {
          setError("Invalid email or password")
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