"use client"

import Link from "next/link"
import { useLocale } from "@/lib/i18n/translate"

// S1b-b1 - "AforAudience is opening soon". Rendered in place of "/" and the
// public discovery routes while launch wave W1 is closed (see
// src/lib/launch-waves.server.ts). Dark theme, tokens only. Links go to the
// two public pages that are always reachable.
export default function LaunchHoldingPage() {
  const { t: tr } = useLocale()
  const linkStyle = {
    color: "var(--afa-amber)",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: "var(--afa-text-body)",
  } as const
  return (
    <main
      data-afa-launch-holding
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
      style={{ background: "var(--afa-surface-page)", textAlign: "center" }}
    >
      <p
        aria-hidden="true"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--afa-text-page-title)",
          fontWeight: 700,
          color: "var(--afa-text-primary)",
          lineHeight: "round(1.2em, 1px)",
          marginBottom: "var(--afa-space-6)",
        }}
      >
        <span style={{ color: "var(--afa-brand-mark)" }}>A</span>forAudience
      </p>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--afa-text-subtitle)",
          fontWeight: 400,
          color: "var(--afa-text-secondary)",
          lineHeight: "round(1.4em, 1px)",
          maxWidth: "32rem",
          marginBottom: "var(--afa-space-32px)",
        }}
      >
        {tr.launchWaves.holdingTitle}
      </h1>
      <nav style={{ display: "flex", gap: "var(--afa-space-6)", flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/about" style={linkStyle}>
          {tr.launchWaves.holdingAboutLink}
        </Link>
        <Link href="/contact" style={linkStyle}>
          {tr.launchWaves.holdingContactLink}
        </Link>
      </nav>
      {/* S1b-c1 - the site chrome is hidden here (globals.css), so admins
          need their own small way in. Part 70 Next #2: the text stays
          caption-size, but the tap box is 44x44px (the same 40+4 space-scale
          build as the tickets actions). marginTop drops from 24px to 10px so
          the text's centre stays where it was (24 + 15/2 vs 10 + 44/2). */}
      <Link
        href="/login"
        data-afa-holding-signin
        style={{
          marginTop: "var(--afa-space-10px)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "calc(var(--afa-space-40px) + var(--afa-space-1))",
          minWidth: "calc(var(--afa-space-40px) + var(--afa-space-1))",
          color: "var(--afa-text-secondary)",
          fontSize: "var(--afa-text-caption)",
          textDecoration: "underline",
        }}
      >
        {tr.nav.signIn}
      </Link>
    </main>
  )
}
