"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import SiteNav from "@/components/SiteNav"

interface LeaderboardEntry {
  id: string
  name: string
  avgRating: number
  reviewCount: number
}

interface WallOfFameData {
  month: string
  minReviews: number
  artistOfMonth: { id: string; name: string; avatar: string | null; avgRating: number; reviewCount: number } | null
  eventOfMonth: { id: string; title: string; posterImage: string | null; avgRating: number; reviewCount: number } | null
  topOrganisers: LeaderboardEntry[]
  topVenues: LeaderboardEntry[]
}

export default function WallOfFamePage() {
  const [data, setData] = useState<WallOfFameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/wall-of-fame")
        if (!res.ok) throw new Error("Failed to load Wall of Fame")
        setData(await res.json())
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const stars = (avg: number) => "★".repeat(Math.round(avg)) + "☆".repeat(5 - Math.round(avg))

  return (
    <main style={{ minHeight: "100vh", background: "#F7F3EE", fontFamily: "system-ui, sans-serif" }}>
      <SiteNav active="wall-of-fame" />

      {/* HERO */}
      <div style={{ background: "#0E0C0A", padding: "56px 48px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: "40px", marginBottom: "8px" }}>🏆</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 900, color: "white", marginBottom: "8px", lineHeight: 1.1 }}>
            Wall of <em style={{ color: "#C8441A", fontStyle: "italic" }}>Fame</em>
          </div>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.5)" }}>
            {loading ? "Loading…" : data ? `Top-rated artist and event of ${data.month}` : ""}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 24px 80px" }}>
        {error && (
          <div style={{ padding: "14px 16px", background: "#FDECEA", border: "1px solid #F5C2C0", borderRadius: "8px", color: "#B3261E", fontSize: "14px", marginBottom: "24px" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#0E0C0A", opacity: 0.5 }}>Loading…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            {/* ARTIST OF THE MONTH */}
            <div style={{ background: "white", borderRadius: "16px", border: "1px solid rgba(14,12,10,0.08)", overflow: "hidden" }}>
              <div style={{ background: "linear-gradient(135deg, #1a0500, #C8441A)", padding: "28px 28px 24px" }}>
                <div style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)", marginBottom: "6px" }}>
                  🎤 Artist of the Month
                </div>
                {data?.artistOfMonth ? (
                  <>
                    <div style={{ fontFamily: "Georgia, serif", fontSize: "26px", fontWeight: 700, color: "white" }}>{data.artistOfMonth.name}</div>
                    <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.75)", marginTop: "4px" }}>
                      {stars(data.artistOfMonth.avgRating)} {data.artistOfMonth.avgRating.toFixed(1)} · {data.artistOfMonth.reviewCount} reviews
                    </div>
                  </>
                ) : (
                  <div style={{ fontFamily: "Georgia, serif", fontSize: "20px", color: "rgba(255,255,255,0.6)" }}>Not enough reviews yet</div>
                )}
              </div>
              <div style={{ padding: "20px 28px" }}>
                <p style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.55, lineHeight: 1.6, margin: 0 }}>
                  {data?.artistOfMonth
                    ? `Highest average audience rating this month, with at least ${data.minReviews} reviews.`
                    : `Once an artist gets at least ${data?.minReviews ?? 3} reviews in a calendar month, they'll show up here.`}
                </p>
                {data?.artistOfMonth && (
                  <Link href={`/artists/${data.artistOfMonth.id}`} style={{ display: "inline-block", marginTop: "16px", fontSize: "13px", fontWeight: 600, color: "#C8441A", textDecoration: "none" }}>
                    View profile →
                  </Link>
                )}
              </div>
            </div>

            {/* EVENT OF THE MONTH */}
            <div style={{ background: "white", borderRadius: "16px", border: "1px solid rgba(14,12,10,0.08)", overflow: "hidden" }}>
              <div style={{ background: "linear-gradient(135deg, #1a0500, #C8441A)", padding: "28px 28px 24px" }}>
                <div style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)", marginBottom: "6px" }}>
                  🎪 Event of the Month
                </div>
                {data?.eventOfMonth ? (
                  <>
                    <div style={{ fontFamily: "Georgia, serif", fontSize: "26px", fontWeight: 700, color: "white" }}>{data.eventOfMonth.title}</div>
                    <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.75)", marginTop: "4px" }}>
                      {stars(data.eventOfMonth.avgRating)} {data.eventOfMonth.avgRating.toFixed(1)} · {data.eventOfMonth.reviewCount} reviews
                    </div>
                  </>
                ) : (
                  <div style={{ fontFamily: "Georgia, serif", fontSize: "20px", color: "rgba(255,255,255,0.6)" }}>Not enough reviews yet</div>
                )}
              </div>
              <div style={{ padding: "20px 28px" }}>
                <p style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.55, lineHeight: 1.6, margin: 0 }}>
                  {data?.eventOfMonth
                    ? `Highest average audience rating this month, with at least ${data.minReviews} reviews.`
                    : `Once an event gets at least ${data?.minReviews ?? 3} reviews in a calendar month, it'll show up here.`}
                </p>
                {data?.eventOfMonth && (
                  <Link href={`/events/${data.eventOfMonth.id}`} style={{ display: "inline-block", marginTop: "16px", fontSize: "13px", fontWeight: 600, color: "#C8441A", textDecoration: "none" }}>
                    View event →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TOP VENUES / TOP ORGANISERS — all-time leaderboard, separate from the monthly awards above */}
        {!loading && data && (data.topVenues.length > 0 || data.topOrganisers.length > 0) && (
          <div style={{ marginTop: "40px" }}>
            <div style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#C8441A", marginBottom: "16px", textAlign: "center" }}>
              All-Time Leaderboard
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
              <div style={{ background: "white", borderRadius: "16px", border: "1px solid rgba(14,12,10,0.08)", padding: "24px 28px" }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "#0E0C0A", marginBottom: "16px" }}>🎪 Top Organisers</div>
                {data.topOrganisers.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.5 }}>No organiser has {data.minReviews}+ reviews yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {data.topOrganisers.map((o, i) => (
                      <div key={o.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", borderBottom: i < data.topOrganisers.length - 1 ? "1px solid rgba(14,12,10,0.06)" : "none" }}>
                        <div style={{ fontFamily: "Georgia, serif", fontSize: "16px", fontWeight: 700, color: "#C8441A", width: "20px" }}>{i + 1}</div>
                        <div style={{ flex: 1, fontSize: "14px", fontWeight: 600, color: "#0E0C0A" }}>{o.name}</div>
                        <div style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.6 }}>{o.avgRating.toFixed(1)}★ · {o.reviewCount}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ background: "white", borderRadius: "16px", border: "1px solid rgba(14,12,10,0.08)", padding: "24px 28px" }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "#0E0C0A", marginBottom: "16px" }}>🏛️ Top Venues</div>
                {data.topVenues.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.5 }}>No venue has {data.minReviews}+ reviews yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {data.topVenues.map((v, i) => (
                      <div key={v.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", borderBottom: i < data.topVenues.length - 1 ? "1px solid rgba(14,12,10,0.06)" : "none" }}>
                        <div style={{ fontFamily: "Georgia, serif", fontSize: "16px", fontWeight: 700, color: "#C8441A", width: "20px" }}>{i + 1}</div>
                        <div style={{ flex: 1, fontSize: "14px", fontWeight: 600, color: "#0E0C0A" }}>{v.name}</div>
                        <div style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.6 }}>{v.avgRating.toFixed(1)}★ · {v.reviewCount}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
