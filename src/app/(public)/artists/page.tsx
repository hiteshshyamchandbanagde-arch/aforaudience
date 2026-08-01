"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import SiteNav from "@/components/SiteNav"

type SceneStatusTier = "NEW_EMERGING" | "RISING" | "FEATURED" | "HEADLINER"

interface ArtistItem {
  id: string
  bio: string
  genre: string[]
  styleTag: string[]
  user: { name: string; avatar: string | null }
  _count: { performances: number }
  sceneStatus?: SceneStatusTier
}

// Card badge is deliberately restrained compared to the full profile-page
// badge (see ArtistProfileClientPage.tsx) - on a dense grid, a pill on
// every card gets loud fast. Only the two tiers people actually scan for
// when deciding who to book/see get a card indicator; RISING is a softer
// signal that reads fine as a badge on one artist's own profile but as
// noise across a whole grid, so it's intentionally left off cards.
const CARD_BADGE: Partial<Record<SceneStatusTier, { label: string; bg: string; color: string }>> = {
  HEADLINER: { label: "★ Headliner", bg: "var(--afa-gold)", color: "var(--afa-plum-black)" },
  FEATURED: { label: "Featured", bg: "rgba(255,255,255,0.14)", color: "var(--afa-gold)" },
}

const SCENE_STATUS_RANK: Record<SceneStatusTier, number> = {
  HEADLINER: 3,
  FEATURED: 2,
  RISING: 1,
  NEW_EMERGING: 0,
}

export default function ArtistsPage() {
  const [artists, setArtists] = useState<ArtistItem[]>([])
  const [approvedGenres, setApprovedGenres] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [selectedGenre, setSelectedGenre] = useState("All")

  useEffect(() => {
    const fetchArtists = async () => {
      try {
        const [artistsRes, genresRes] = await Promise.all([
          fetch("/api/artists"),
          fetch("/api/genres/approved"),
        ])
        if (!artistsRes.ok) throw new Error("Failed to load artists")
        const data = await artistsRes.json()
        setArtists(data)
        if (genresRes.ok) setApprovedGenres((await genresRes.json()).genres)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchArtists()
  }, [])

  // Filter dropdown only ever shows admin-approved genres (presets +
  // approved "Other" submissions) - NOT every raw value in artists' own
  // genre arrays, which is what let unapproved garbage become a public
  // filter option before this (session 39, PR #224). An artist's own
  // card still displays their genre exactly as saved, untouched by this.
  const genres = approvedGenres

  const filtered = artists
    .filter((a) => {
      const matchSearch =
        a.user.name.toLowerCase().includes(search.toLowerCase()) ||
        a.genre.some((g) => g.toLowerCase().includes(search.toLowerCase()))
      const matchGenre = selectedGenre === "All" || a.genre.includes(selectedGenre)
      return matchSearch && matchGenre
    })
    .sort((a, b) => b._count.performances - a._count.performances)

  // Rising Star now keys off real Scene Status (Headliner > Featured >
  // Rising > New/Emerging), gig count only as a tiebreaker within the
  // same tier - the placeholder this used to be (raw gig count only) is
  // gone now that Scene Status has shipped.
  const risingStar =
    artists.length > 0
      ? [...artists].sort((a, b) => {
          const rankDiff = SCENE_STATUS_RANK[b.sceneStatus ?? "NEW_EMERGING"] - SCENE_STATUS_RANK[a.sceneStatus ?? "NEW_EMERGING"]
          return rankDiff !== 0 ? rankDiff : b._count.performances - a._count.performances
        })[0]
      : null

  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-cream)", fontFamily: "system-ui, sans-serif" }}>
      <SiteNav active="artists" />

      {/* HERO */}
      <div style={{ background: "var(--afa-ink)", padding: "56px 48px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 900, color: "white", marginBottom: "8px", lineHeight: 1.1 }}>
            Discover <em style={{ color: "var(--afa-terracotta)", fontStyle: "italic" }}>Artists</em>
          </div>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.5)", marginBottom: "32px" }}>
            {loading ? "Loading artists..." : `${filtered.length} artists performing live`}
          </p>
          <div style={{ position: "relative" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search artists, genres..."
              style={{ width: "100%", padding: "18px 56px 18px 20px", borderRadius: "10px", border: "none", fontSize: "16px", background: "white", color: "var(--afa-ink)", outline: "none", boxSizing: "border-box" }}
            />
            <span style={{ position: "absolute", right: "20px", top: "50%", transform: "translateY(-50%)", fontSize: "20px" }}>🔍</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
        {error && (
          <div style={{ padding: "14px 16px", background: "var(--afa-error-bg)", border: "1px solid var(--afa-error-border)", borderRadius: "8px", color: "var(--afa-error)", fontSize: "14px", marginBottom: "24px" }}>
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
                style={{ padding: "7px 14px", borderRadius: "99px", border: `1.5px solid ${selectedGenre === g ? "var(--afa-terracotta)" : "rgba(14,12,10,0.12)"}`, background: selectedGenre === g ? "var(--afa-terracotta)" : "transparent", color: selectedGenre === g ? "white" : "var(--afa-ink)", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* RISING STAR */}
        {risingStar && (
          <div style={{ background: "linear-gradient(135deg, var(--afa-maroon-black), var(--afa-terracotta))", borderRadius: "16px", padding: "24px 32px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "56px" }}>🌟</div>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <div style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: "4px" }}>Top Artist Right Now</div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "white", marginBottom: "4px" }}>{risingStar.user.name}</div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)" }}>{risingStar._count.performances} show{risingStar._count.performances === 1 ? "" : "s"}</div>
            </div>
            <Link href={`/artists/${risingStar.id}`} style={{ background: "white", color: "var(--afa-terracotta)", padding: "12px 24px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>View Profile</Link>
          </div>
        )}

        {/* ARTIST GRID */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--afa-ink)", opacity: 0.5 }}>Loading artists...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: "64px", marginBottom: "16px" }}>🎤</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "8px" }}>
              {artists.length === 0 ? "No artists yet" : "No artists found"}
            </div>
            <p style={{ fontSize: "14px", color: "var(--afa-ink)", opacity: 0.5 }}>
              {artists.length === 0 ? "Check back soon!" : "Try adjusting your filters"}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
            {filtered.map((artist) => (
              <Link key={artist.id} href={`/artists/${artist.id}`} style={{ textDecoration: "none" }}>
                <div
                  className="hover-lift-card"
                  style={{ background: "white", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(14,12,10,0.08)", cursor: "pointer" }}
                >
                  <div style={{ height: "120px", background: "var(--afa-plum-black)", display: "flex", alignItems: "center", padding: "24px", gap: "16px" }}>
                    <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "3px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontWeight: 700, color: "white", flexShrink: 0, overflow: "hidden" }}>
                      {artist.user.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={artist.user.avatar} alt={artist.user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        artist.user.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                        <div style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: 700, color: "white" }}>{artist.user.name}</div>
                        {artist.sceneStatus && CARD_BADGE[artist.sceneStatus] && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "99px",
                              letterSpacing: "0.03em",
                              textTransform: "uppercase",
                              background: CARD_BADGE[artist.sceneStatus]!.bg,
                              color: CARD_BADGE[artist.sceneStatus]!.color,
                              border: artist.sceneStatus === "FEATURED" ? "1px solid var(--afa-gold)" : "none",
                            }}
                          >
                            {CARD_BADGE[artist.sceneStatus]!.label}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>{artist.genre.join(", ") || "Genre not set"}</div>
                    </div>
                  </div>

                  <div style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px", minHeight: "24px" }}>
                      {artist.styleTag.map((tag) => (
                        <span key={tag} style={{ background: "var(--afa-cream)", color: "var(--afa-ink)", fontSize: "11px", padding: "3px 10px", borderRadius: "99px", fontWeight: 500 }}>{tag}</span>
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "var(--afa-ink)" }}>{artist._count.performances}</div>
                        <div style={{ fontSize: "11px", color: "var(--afa-ink)", opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Shows</div>
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
