"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import SiteNav from "@/components/SiteNav"

interface ArtistItem {
  id: string
  bio: string
  genre: string[]
  styleTag: string[]
  hypScore: number
  user: { name: string; avatar: string | null }
  _count: { performances: number }
}

export default function ArtistsPage() {
  const [artists, setArtists] = useState<ArtistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [selectedGenre, setSelectedGenre] = useState("All")
  const [sortBy, setSortBy] = useState<"hype" | "shows">("hype")

  useEffect(() => {
    const fetchArtists = async () => {
      try {
        const res = await fetch("/api/artists")
        if (!res.ok) throw new Error("Failed to load artists")
        const data = await res.json()
        setArtists(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchArtists()
  }, [])

  const genres = Array.from(new Set(artists.flatMap((a) => a.genre)))

  const filtered = artists
    .filter((a) => {
      const matchSearch =
        a.user.name.toLowerCase().includes(search.toLowerCase()) ||
        a.genre.some((g) => g.toLowerCase().includes(search.toLowerCase()))
      const matchGenre = selectedGenre === "All" || a.genre.includes(selectedGenre)
      return matchSearch && matchGenre
    })
    .sort((a, b) => (sortBy === "hype" ? b.hypScore - a.hypScore : b._count.performances - a._count.performances))

  const risingStar = artists.length > 0 ? [...artists].sort((a, b) => b.hypScore - a.hypScore)[0] : null

  return (
    <main style={{ minHeight: "100vh", background: "#F7F3EE", fontFamily: "system-ui, sans-serif" }}>
      <SiteNav active="artists" />

      {/* HERO */}
      <div style={{ background: "#0E0C0A", padding: "56px 48px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 900, color: "white", marginBottom: "8px", lineHeight: 1.1 }}>
            Discover <em style={{ color: "#C8441A", fontStyle: "italic" }}>Artists</em>
          </div>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.5)", marginBottom: "32px" }}>
            {loading ? "Loading artists..." : `${filtered.length} artists performing live`}
          </p>
          <div style={{ position: "relative" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search artists, genres..."
              style={{ width: "100%", padding: "18px 56px 18px 20px", borderRadius: "10px", border: "none", fontSize: "16px", background: "white", color: "#0E0C0A", outline: "none", boxSizing: "border-box" }}
            />
            <span style={{ position: "absolute", right: "20px", top: "50%", transform: "translateY(-50%)", fontSize: "20px" }}>🔍</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
        {error && (
          <div style={{ padding: "14px 16px", background: "#FDECEA", border: "1px solid #F5C2C0", borderRadius: "8px", color: "#B3261E", fontSize: "14px", marginBottom: "24px" }}>
            {error}
          </div>
        )}

        {/* FILTERS */}
        <div style={{ background: "white", borderRadius: "12px", padding: "20px 24px", marginBottom: "24px", border: "1px solid rgba(14,12,10,0.08)", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {["All", ...genres].map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGenre(g)}
                style={{ padding: "7px 14px", borderRadius: "99px", border: `1.5px solid ${selectedGenre === g ? "#C8441A" : "rgba(14,12,10,0.12)"}`, background: selectedGenre === g ? "#C8441A" : "transparent", color: selectedGenre === g ? "white" : "#0E0C0A", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}
              >
                {g}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: "auto" }}>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "hype" | "shows")} style={{ padding: "8px 14px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.12)", fontSize: "13px", color: "#0E0C0A", background: "white", cursor: "pointer", outline: "none" }}>
              <option value="hype">Sort: Hype Score</option>
              <option value="shows">Sort: Most Shows</option>
            </select>
          </div>
        </div>

        {/* RISING STAR */}
        {risingStar && (
          <div style={{ background: "linear-gradient(135deg, #1a0500, #C8441A)", borderRadius: "16px", padding: "24px 32px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "56px" }}>🌟</div>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <div style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: "4px" }}>Top Artist Right Now</div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "white", marginBottom: "4px" }}>{risingStar.user.name}</div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)" }}>Hype Score {risingStar.hypScore.toFixed(1)} · {risingStar._count.performances} shows</div>
            </div>
            <Link href={`/artists/${risingStar.id}`} style={{ background: "white", color: "#C8441A", padding: "12px 24px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>View Profile</Link>
          </div>
        )}

        {/* ARTIST GRID */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#0E0C0A", opacity: 0.5 }}>Loading artists...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: "64px", marginBottom: "16px" }}>🎤</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "#0E0C0A", marginBottom: "8px" }}>
              {artists.length === 0 ? "No artists yet" : "No artists found"}
            </div>
            <p style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.5 }}>
              {artists.length === 0 ? "Check back soon!" : "Try adjusting your filters"}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
            {filtered.map((artist) => (
              <Link key={artist.id} href={`/artists/${artist.id}`} style={{ textDecoration: "none" }}>
                <div
                  style={{ background: "white", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(14,12,10,0.08)", transition: "transform 0.2s, box-shadow 0.2s", cursor: "pointer" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 40px rgba(0,0,0,0.1)" }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none" }}
                >
                  <div style={{ height: "120px", background: "#1a0a1a", display: "flex", alignItems: "center", padding: "24px", gap: "16px" }}>
                    <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "3px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontWeight: 700, color: "white", flexShrink: 0 }}>
                      {artist.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: 700, color: "white", marginBottom: "4px" }}>{artist.user.name}</div>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>{artist.genre.join(", ") || "Genre not set"}</div>
                    </div>
                  </div>

                  <div style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px", minHeight: "24px" }}>
                      {artist.styleTag.map((tag) => (
                        <span key={tag} style={{ background: "#F7F3EE", color: "#0E0C0A", fontSize: "11px", padding: "3px 10px", borderRadius: "99px", fontWeight: 500 }}>{tag}</span>
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-around" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "#0E0C0A" }}>🔥 {artist.hypScore.toFixed(1)}</div>
                        <div style={{ fontSize: "11px", color: "#0E0C0A", opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Hype</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "#0E0C0A" }}>{artist._count.performances}</div>
                        <div style={{ fontSize: "11px", color: "#0E0C0A", opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Shows</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
