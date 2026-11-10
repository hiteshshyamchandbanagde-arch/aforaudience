"use client"

import Link from "next/link"
import { useLocale } from "@/lib/i18n/translate"

// S1b-b1 - shown on /register instead of the form while launch wave W1 is
// closed. The sign-in link stays: existing members are never affected.
export default function SignupsSoon() {
  const { t: tr } = useLocale()
  return (
    <div data-afa-signups-soon style={{ width: "100%", maxWidth: "480px", textAlign: "center" }}>
      <Link href="/" className="lg:hidden" style={{ fontFamily: "var(--font-display)", fontSize: "var(--afa-text-page-title)", fontWeight: 700, color: "var(--afa-text-primary)", textDecoration: "none" }}>
        <span style={{ color: "var(--afa-brand-mark)" }}>A</span>forAudience
      </Link>
      <div style={{ background: "var(--afa-surface-raised)", borderRadius: "var(--afa-radius-xl)", padding: "var(--afa-space-32px) var(--afa-space-6)", border: "1px solid var(--afa-tint-08)", marginTop: "var(--afa-space-6)" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--afa-text-subtitle)", fontWeight: 400, color: "var(--afa-text-primary)", lineHeight: "round(1.4em, 1px)" }}>
          {tr.launchWaves.signupsSoonTitle}
        </h1>
      </div>
      <p style={{ marginTop: "var(--afa-space-6)", fontSize: "var(--afa-text-body)" }}>
        <span style={{ color: "var(--afa-text-primary)", opacity: 0.6 }}>{tr.registerPage.alreadyHaveAccountPrefix}</span>{" "}
        <Link href="/login" style={{ color: "var(--afa-amber)", textDecoration: "none", fontWeight: 500 }}>{tr.registerPage.signInLink}</Link>
      </p>
    </div>
  )
}
