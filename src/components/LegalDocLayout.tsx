import Link from "next/link"
import SiteNav from "@/components/SiteNav"

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

// Shared shell for /privacy and /terms. Both are marked as drafts pending
// legal review (see design doc §9.1) - not final, but published to QA so
// Hitesh can review the actual rendered page before the CA/lawyer pass and
// eventual prod promotion once the company is registered.
export default function LegalDocLayout({ title, lastUpdated, children }: LegalDocLayoutProps) {
  return (
    <main style={{ minHeight: "100vh", background: PAPER, fontFamily: SANS }}>
      <SiteNav />
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 24px 96px" }}>
        <Link href="/" style={{ fontSize: "14px", color: EMBER, textDecoration: "none", fontWeight: 600 }}>
          ← Back to AforAudience
        </Link>

        <div
          style={{
            marginTop: "24px",
            marginBottom: "32px",
            padding: "16px 20px",
            borderRadius: "10px",
            background: "#FDF3E8",
            border: "1px solid #E8C9A0",
          }}
        >
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#8A5A1E", marginBottom: "4px" }}>
            Draft — pending legal review
          </p>
          <p style={{ fontSize: "13px", color: INK, opacity: 0.75, lineHeight: 1.6 }}>
            This page reflects our current plan, not a finalized legal document. It will be reviewed with our CA and a
            lawyer once the company is formally registered, and this notice will be removed once that review is
            complete.
          </p>
        </div>

        <h1 style={{ fontFamily: SERIF, fontSize: "clamp(30px, 4vw, 42px)", fontWeight: 700, color: INK, marginBottom: "8px" }}>
          {title}
        </h1>
        <p style={{ fontSize: "13px", color: INK, opacity: 0.5, marginBottom: "40px" }}>Last updated: {lastUpdated}</p>

        <div style={{ fontSize: "16px", lineHeight: 1.75, color: INK }}>{children}</div>
      </div>
    </main>
  )
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: SERIF,
        fontSize: "22px",
        fontWeight: 700,
        color: INK,
        marginTop: "40px",
        marginBottom: "14px",
        paddingBottom: "10px",
        borderBottom: `1px solid ${MIST}`,
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
    <span style={{ background: "#FDF3E8", color: "#8A5A1E", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
      {children}
    </span>
  )
}
