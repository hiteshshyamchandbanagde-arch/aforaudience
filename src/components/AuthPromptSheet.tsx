"use client"
import { useRef, useState } from "react"
import Link from "next/link"
import { signIn } from "next-auth/react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import { useModalSheet } from "@/lib/use-modal-sheet"

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
  const sheetRef = useRef<HTMLDivElement>(null)
  useModalSheet(open, sheetRef, onClose)

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
        style={{ position: "absolute", inset: 0, background: "var(--afa-scrim)", animation: "authSheetFadeIn 0.15s ease-out" }}
      />

      <div
        ref={sheetRef}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "480px",
          background: "var(--afa-surface-raised)",
          borderRadius: "var(--afa-radius-2xl) var(--afa-radius-2xl) var(--afa-radius-sharp) var(--afa-radius-sharp)",
          padding: "var(--afa-space-2) var(--afa-space-6) var(--afa-space-28px)",
          boxShadow: "0 -8px 40px var(--afa-shadow)",
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
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--afa-space-10px) 0" }}>
          <div style={{ width: "36px", height: "4px", borderRadius: "var(--afa-radius-xs)", background: "var(--afa-border-resting)" }} />
        </div>

        <div style={{ textAlign: "center", marginBottom: "var(--afa-space-5)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--afa-text-subtitle)", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: subtitle ? "4px" : 0 }}>
            {title}
          </h2>
          {subtitle && <div style={{ fontSize: "var(--afa-text-ui)", color: "var(--afa-text-primary)", opacity: 0.55 }}>{subtitle}</div>}
        </div>

        {error && (
          <div style={{ background: "var(--afa-error-tint)", border: "1px solid var(--afa-error-edge)", borderRadius: "var(--afa-radius-md)", padding: "var(--afa-space-10px) var(--afa-space-14px)", marginBottom: "var(--afa-space-4)", fontSize: "var(--afa-text-ui)", color: "var(--afa-error-bright)" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--afa-space-3)", marginBottom: "var(--afa-space-4)" }}>
          {[
            { label: "Email / Phone / Username / Code", name: "identifier", type: "text", placeholder: "you@example.com" },
            { label: "Password", name: "password", type: "password", placeholder: "Your password" },
          ].map((field) => (
            <div key={field.name}>
              <label style={{ fontSize: "var(--afa-text-small)", fontWeight: 500, color: "var(--afa-text-primary)", opacity: 0.7, display: "block", marginBottom: "5px" }}>
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

        <Button variant="primary" onClick={handleSignIn} disabled={loading} style={{ marginBottom: "var(--afa-space-3)" }}>
          {loading ? "Signing in..." : "Sign In & Continue"}
        </Button>

        <div style={{ textAlign: "center", fontSize: "var(--afa-text-ui)", color: "var(--afa-text-primary)", opacity: 0.6, marginBottom: "var(--afa-space-1)" }}>
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
