"use client"

import Link from "next/link"
import SiteNav from "@/components/SiteNav"
import { useLocale } from "@/lib/i18n/translate"

type ComingSoonProps = {
  title: string
  description?: string
}

export default function ComingSoon({ title, description }: ComingSoonProps) {
  const { t: tr } = useLocale()
  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-surface-raised)", fontFamily: "system-ui, sans-serif" }}>
      <SiteNav />
      <div
        style={{
          minHeight: "calc(100vh - 65px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "48px 24px",
        }}
      >
        <div style={{ fontFamily: "monospace", fontSize: "12px", letterSpacing: "0.12em", color: "var(--afa-terracotta)", textTransform: "uppercase", marginBottom: "20px" }}>
          {tr.comingSoon.badge}
        </div>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "36px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "16px" }}>
          {title}
        </h1>
        <p style={{ fontSize: "15px", color: "var(--afa-text-primary)", opacity: 0.6, maxWidth: "440px", lineHeight: 1.6, marginBottom: "32px" }}>
          {description ?? tr.comingSoon.defaultDescription}
        </p>
        <Link
          href="/"
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--afa-on-fill-solid)",
            textDecoration: "none",
            background: "var(--afa-fill-solid)",
            padding: "12px 28px",
            borderRadius: "6px",
          }}
        >
          {tr.comingSoon.backHome}
        </Link>
      </div>
    </main>
  )
}
