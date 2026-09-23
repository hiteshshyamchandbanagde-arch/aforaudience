import Link from "next/link"
import SiteNav from "@/components/SiteNav"

// GEN-2609-067 - retargeted from the legacy light-theme palette to the
// current dark-theme tokens, same reasoning as about/page.tsx.
const INK = "var(--afa-text-primary)"
const PAPER = "var(--afa-surface-page)"
const EMBER = "var(--afa-fill-solid)"
const MIST = "rgba(245,245,240,0.12)"
const SERIF = "var(--font-display)"
const SANS = "var(--font-sans)"

type LegalDocLayoutProps = {
  title: string
  lastUpdated: React.ReactNode
  children: React.ReactNode
}

// Shared shell for /privacy and /terms. Both are marked as drafts pending
// legal review (see design doc §9.1) - not final, but published to QA so
// Hitesh can review the actual rendered page before the CA/lawyer pass and
// eventual prod promotion once the company is registered.
export default function LegalDocLayout({ title, lastUpdated, children }: LegalDocLayoutProps) {
  return (
    <main style={{ minHeight: "100vh", background: PAPER, fontFamily: SANS }}>
      <SiteNav />
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 24px 96px" }}>
        <Link href="/" style={{ fontSize: "var(--afa-text-body)", color: EMBER, textDecoration: "none", fontWeight: 600 }}>
          ← Back to AforAudience
        </Link>

        <div
          style={{
            marginTop: "24px",
            marginBottom: "32px",
            padding: "16px 20px",
            borderRadius: "10px",
            background: "rgba(201,151,58,0.15)",
            border: "1px solid var(--afa-amber)",
          }}
        >
          <p style={{ fontSize: "var(--afa-text-ui)", fontWeight: 700, color: "var(--afa-amber)", marginBottom: "4px" }}>
            Draft — pending legal review
          </p>
          <p style={{ fontSize: "var(--afa-text-ui)", color: INK, opacity: 0.75, lineHeight: 1.6 }}>
            This page reflects our current plan, not a finalized legal document. It will be reviewed with our CA and a
            lawyer once the company is formally registered, and this notice will be removed once that review is
            complete.
          </p>
        </div>

        <h1 style={{ fontFamily: SERIF, fontSize: "clamp(30px, 4vw, 42px)", fontWeight: 700, color: INK, marginBottom: "8px" }}>
          {title}
        </h1>
        <p style={{ fontSize: "var(--afa-text-ui)", color: INK, opacity: 0.5, marginBottom: "40px" }}>Last updated: {lastUpdated}</p>

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
    <span style={{ background: "rgba(201,151,58,0.15)", color: "var(--afa-amber)", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
      {children}
    </span>
  )
}
