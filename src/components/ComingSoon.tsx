import Link from "next/link"
import SiteNav from "@/components/SiteNav"

type ComingSoonProps = {
  title: string
  description?: string
}

export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <main style={{ minHeight: "100vh", background: "#F7F3EE", fontFamily: "system-ui, sans-serif" }}>
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
        <div style={{ fontFamily: "monospace", fontSize: "12px", letterSpacing: "0.12em", color: "#C8441A", textTransform: "uppercase", marginBottom: "20px" }}>
          Coming Soon
        </div>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "36px", fontWeight: 700, color: "#0E0C0A", marginBottom: "16px" }}>
          {title}
        </h1>
        <p style={{ fontSize: "15px", color: "#0E0C0A", opacity: 0.6, maxWidth: "440px", lineHeight: 1.6, marginBottom: "32px" }}>
          {description ?? "We're still putting this page together. Check back soon."}
        </p>
        <Link
          href="/"
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#F7F3EE",
            textDecoration: "none",
            background: "#0E0C0A",
            padding: "12px 28px",
            borderRadius: "6px",
          }}
        >
          Back to Home
        </Link>
      </div>
    </main>
  )
}
