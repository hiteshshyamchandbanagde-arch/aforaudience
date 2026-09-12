"use client"
import { useState } from "react"
import Link from "next/link"
import { signIn } from "next-auth/react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"

type AuthPromptSheetProps = {
  open: boolean
  onClose: () => void
  /** Contextual copy tied to the action just taken, e.g. "Sign in to complete your booking" */
  title: string
  /** Optional secondary line, e.g. "2 seats · ₹798" */
  subtitle?: string
  /** Called after a successful sign-in so the caller can resume the queued action in place. */
  onSuccess: () => void
}

/**
 * Contextual, resumable login prompt — replaces hard redirects to /login.
 * Opens in place over whatever the user was doing (per Revised Onboarding
 * Flow §4: "contextual bottom-sheet prompt, not a redirect to a separate
 * screen" + "user lands back exactly where they were, action already queued").
 *
 * Registration has no role picker any more (browse-first model - everyone
 * signs up as AUDIENCE), so the "Create an account" link below just goes to
 * the plain /register route.
 */
export default function AuthPromptSheet({
  open,
  onClose,
  title,
  subtitle,
  onSuccess,
}: AuthPromptSheetProps) {
  const [form, setForm] = useState({ identifier: "", password: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  if (!open) return null

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSignIn = async () => {
    setLoading(true)
    setError("")
    try {
      const result = await signIn("credentials", {
        identifier: form.identifier.trim(),
        password: form.password,
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
        setLoading(false)
        return
      }
      setLoading(false)
      onSuccess()
    } catch {
      setError("Something went wrong")
      setLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      {/* Overlay — click to dismiss, resuming guest browsing (no forced login) */}
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(245,245,240,0.45)", animation: "authSheetFadeIn 0.15s ease-out" }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "480px",
          background: "var(--afa-surface-raised)",
          borderRadius: "20px 20px 0 0",
          padding: "8px 24px 28px",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
          animation: "authSheetSlideUp 0.22s ease-out",
          maxHeight: "88vh",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        <style>{`
          @keyframes authSheetSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes authSheetFadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>

        {/* Grab handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
          <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: "rgba(245,245,240,0.15)" }} />
        </div>

        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: subtitle ? "4px" : 0 }}>
            {title}
          </h2>
          {subtitle && <div style={{ fontSize: "13px", color: "var(--afa-text-primary)", opacity: 0.55 }}>{subtitle}</div>}
        </div>

        {error && (
          <div style={{ background: "rgba(179,38,30,0.1)", border: "1px solid rgba(179,38,30,0.3)", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "var(--afa-error)" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
          {[
            { label: "Email / Phone / Username / Code", name: "identifier", type: "text", placeholder: "you@example.com" },
            { label: "Password", name: "password", type: "password", placeholder: "Your password" },
          ].map((field) => (
            <div key={field.name}>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--afa-text-primary)", opacity: 0.7, display: "block", marginBottom: "5px" }}>
                {field.label}
              </label>
              <Input
                name={field.name}
                type={field.type}
                placeholder={field.placeholder}
                value={form[field.name as keyof typeof form]}
                onChange={handleChange}
                onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
              />
            </div>
          ))}
        </div>

        <Button variant="primary" onClick={handleSignIn} disabled={loading} style={{ marginBottom: "12px" }}>
          {loading ? "Signing in..." : "Sign In & Continue"}
        </Button>

        <div style={{ textAlign: "center", fontSize: "13px", color: "var(--afa-text-primary)", opacity: 0.6, marginBottom: "4px" }}>
          New here?{" "}
          <Link href="/register" style={{ color: "var(--afa-amber)", fontWeight: 600, textDecoration: "none" }}>
            Create an account
          </Link>
        </div>

        <Button variant="secondary" onClick={onClose}>
          Keep browsing
        </Button>
      </div>
    </div>
  )
}
