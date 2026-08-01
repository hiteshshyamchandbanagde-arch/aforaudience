"use client"
import { useEffect, useState, use } from "react"
import Link from "next/link"
import SiteNav from "@/components/SiteNav"
import BrandLoader from "@/components/BrandLoader"

interface OrganiserDetail {
  id: string
  orgName: string
  bio: string | null
  user: { name: string; avatar: string | null }
  events: { id: string; title: string; date: string; venue: { name: string; city: string } | null }[]
  followerCount: number
}

export default function OrganiserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [organiser, setOrganiser] = useState<OrganiserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/organisers/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Organiser not found")
        return res.json()
      })
      .then(setOrganiser)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (<><SiteNav /><BrandLoader /></>)

  if (error || !organiser) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--afa-cream)" }}>
        <SiteNav />
        <div style={{ maxWidth: "600px", margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>🎭</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "8px" }}>Organiser not found</div>
          <Link href="/organisers" style={{ color: "var(--afa-terracotta)", fontSize: "14px", fontWeight: 600 }}>← Back to Organisers</Link>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-cream)", fontFamily: "system-ui, sans-serif" }}>
      <SiteNav />

      <div style={{ background: "var(--afa-plum-black)", padding: "48px 24px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", gap: "24px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: "96px", height: "96px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "3px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px", fontWeight: 700, color: "white", flexShrink: 0, overflow: "hidden" }}>
            {organiser.user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={organiser.user.avatar} alt={organiser.orgName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              organiser.orgName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "32px", fontWeight: 700, color: "white", marginBottom: "6px" }}>{organiser.orgName}</div>
            <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>
              {organiser.followerCount} follower{organiser.followerCount === 1 ? "" : "s"} · {organiser.events.length} event{organiser.events.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ background: "white", borderRadius: "12px", padding: "24px", marginBottom: "24px", border: "1px solid rgba(14,12,10,0.08)" }}>
          <p style={{ fontSize: "14px", color: "var(--afa-ink)", opacity: organiser.bio ? 0.8 : 0.4, lineHeight: 1.6, fontStyle: organiser.bio ? "normal" : "italic" }}>
            {organiser.bio || "This organiser hasn't added a bio yet."}
          </p>
        </div>

        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "16px" }}>Events</h2>
        {organiser.events.length === 0 ? (
          <p style={{ fontSize: "14px", color: "var(--afa-ink)", opacity: 0.5 }}>No published events yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {organiser.events.map((e) => (
              <Link
                key={e.id}
                href={`/events/${e.id}`}
                style={{ display: "block", background: "white", borderRadius: "10px", padding: "16px 20px", border: "1px solid rgba(14,12,10,0.08)", textDecoration: "none" }}
              >
                <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--afa-ink)" }}>{e.title}</div>
                <div style={{ fontSize: "12px", color: "var(--afa-ink)", opacity: 0.5 }}>
                  {e.venue ? `${e.venue.name}, ${e.venue.city}` : "Venue TBD"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
