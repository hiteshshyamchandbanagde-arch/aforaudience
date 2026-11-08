import Link from "next/link"
import SiteNav from "@/components/SiteNav"

// P1 prod port (8 Nov 2026) - copied from qa's src/components/LegalDocLayout.tsx
// (fix/legal-footer-l2). main has no --afa-* design tokens, so every token is
// replaced by its literal value: sizes/spacing from qa's globals.css (identical
// to the token values), colours from main's own light palette (the same
// INK/PAPER/EMBER used by main's homepage and ComingSoon).
const INK = "#0E0C0A"
const PAPER = "#F7F3EE"
const EMBER = "#C8441A"
const MIST = "#E8E2D9"
const SERIF = "Georgia, 'Playfair Display', serif"
const SANS = "system-ui, -apple-system, sans-serif"

type LegalDocLayoutProps = {
  title: string
  lastUpdated: React.ReactNode
  children: React.ReactNode
}

// Shared shell for /privacy, /terms, /refund-policy and /contact.
export default function LegalDocLayout({ title, lastUpdated, children }: LegalDocLayoutProps) {
  return (
    <main style={{ minHeight: "100vh", background: PAPER, fontFamily: SANS }}>
      <SiteNav />
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 24px 96px" }}>
        <Link href="/" style={{ fontSize: "14px", color: EMBER, textDecoration: "none", fontWeight: 600 }}>
          ← Back to AforAudience
        </Link>

        <h1 style={{ marginTop: "32px", fontFamily: SERIF, fontSize: "clamp(30px, 4vw, 42px)", fontWeight: 700, color: INK, marginBottom: "8px" }}>
          {title}
        </h1>
        <p style={{ fontSize: "13px", color: INK, opacity: 0.5, marginBottom: "40px" }}>Last updated: {lastUpdated}</p>

        <div style={{ fontSize: "16px", lineHeight: 1.75, color: INK }}>{children}</div>
      </div>
    </main>
  )
}

export function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      style={{
        fontFamily: SERIF,
        fontSize: "22px",
        fontWeight: 700,
        color: INK,
        marginTop: "40px",
        marginBottom: "14px",
        paddingBottom: "10px",
        borderBottom: `1px solid ${MIST}`,
        scrollMarginTop: "24px",
      }}
    >
      {children}
    </h2>
  )
}

export function P({ children }: { children: React.ReactNode }) {
  return <p style={{ marginBottom: "16px", opacity: 0.88 }}>{children}</p>
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul style={{ marginBottom: "16px", paddingLeft: "22px", opacity: 0.88 }}>{children}</ul>
}

export function LI({ children }: { children: React.ReactNode }) {
  return <li style={{ marginBottom: "8px" }}>{children}</li>
}

export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ background: "#FDF3E8", color: "#8A5A1E", padding: "1px 6px", borderRadius: "3px", fontWeight: 600 }}>
      {children}
    </span>
  )
}
