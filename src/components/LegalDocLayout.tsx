import Link from "next/link"
import SiteNav from "@/components/SiteNav"

// GEN-2609-067 - retargeted from the legacy light-theme palette to the
// current dark-theme tokens, same reasoning as about/page.tsx.
const INK = "var(--afa-text-primary)"
const PAPER = "var(--afa-surface-page)"
const EMBER = "var(--afa-fill-solid)"
const MIST = "var(--afa-tint-12)"
const SERIF = "var(--font-display)"
const SANS = "var(--font-sans)"

type LegalDocLayoutProps = {
  title: string
  lastUpdated: React.ReactNode
  children: React.ReactNode
}

// Shared shell for /terms, /privacy, /refund-policy and /contact. The old
// "Draft — pending legal review" banner was removed in L2b (8 Nov 2026): the
// company is registered and these pages are the published policies.
export default function LegalDocLayout({ title, lastUpdated, children }: LegalDocLayoutProps) {
  return (
    <main style={{ minHeight: "100vh", background: PAPER, fontFamily: SANS }}>
      <SiteNav />
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "var(--afa-space-48px) var(--afa-space-6) 96px" }}>{/* token-ok(spacing-literal): 96px used under 10 times, no exact token (GEN-2609-107) */}
        <Link href="/" style={{ fontSize: "var(--afa-text-body)", color: EMBER, textDecoration: "none", fontWeight: 600 }}>
          ← Back to AforAudience
        </Link>

        <h1 style={{ fontFamily: SERIF, fontSize: "clamp(30px, 4vw, 42px)", fontWeight: 700, color: INK, marginTop: "var(--afa-space-32px)", marginBottom: "var(--afa-space-2)" }}>
          {title}
        </h1>
        <p style={{ fontSize: "var(--afa-text-ui)", color: INK, opacity: 0.5, marginBottom: "var(--afa-space-40px)" }}>Last updated: {lastUpdated}</p>

        <div style={{ fontSize: "var(--afa-text-title)", lineHeight: 1.75, color: INK }}>{children}</div>
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
        fontSize: "var(--afa-text-subheading)",
        fontWeight: 700,
        color: INK,
        marginTop: "var(--afa-space-40px)",
        marginBottom: "var(--afa-space-14px)",
        paddingBottom: "var(--afa-space-10px)",
        borderBottom: `1px solid ${MIST}`,
        scrollMarginTop: "24px",
      }}
    >
      {children}
    </h2>
  )
}

export function P({ children }: { children: React.ReactNode }) {
  return <p style={{ marginBottom: "var(--afa-space-4)", opacity: 0.88 }}>{children}</p>
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul style={{ marginBottom: "var(--afa-space-4)", paddingLeft: "22px", opacity: 0.88 }}>{children}</ul> // token-ok(spacing-literal): 22px used under 10 times, no exact token (GEN-2609-107)
}

export function LI({ children }: { children: React.ReactNode }) {
  return <li style={{ marginBottom: "var(--afa-space-2)" }}>{children}</li>
}

export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ background: "var(--afa-amber-tint)", color: "var(--afa-amber)", padding: "1px var(--afa-space-6px)", borderRadius: "var(--afa-radius-xs)", fontWeight: 600 }}>
      {children}
    </span>
  )
}
