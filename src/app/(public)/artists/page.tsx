"use client"
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import SiteNav from "@/components/SiteNav"
import BrowseSearchDropdown from "@/components/BrowseSearchDropdown"
import { isPlaceholderImageUrl, monogramTone } from "@/lib/placeholder-image"
import { useLocale } from "@/lib/i18n/translate"

type SceneStatusTier = "NEW_EMERGING" | "RISING" | "FEATURED" | "HEADLINER"

interface ArtistItem {
  id: string
  bio: string
  genre: string[]
  styleTag: string[]
  user: { name: string; displayName: string | null; avatar: string | null }
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
  const { t: tr } = useLocale()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [navigatingId, setNavigatingId] = useState<string | null>(null)

  // Same click-guard as /events (PR #261) - a plain Link with no click
  // feedback reads as "nothing happened" on a slow render, so repeat
  // clicks each fired a fresh un-deduped navigation (confirmed via
  // Vercel logs: 10+ duplicate GETs for the same id within seconds on
  // /events). This card grid had the same plain-Link pattern and the
  // same live-reported symptom ("works after 2-3 clicks or more") - the
  // #261 fix was never carried over here. First click claims the card
  // and ignores further clicks until it resolves.
  const goToArtist = (id: string) => {
    if (navigatingId) return
    setNavigatingId(id)
    // Feedback cmsaicfav (2 Aug) - swipe/arrow prev-next on the profile
    // page needs to know "next relative to what". Stashing the id order
    // of the list as currently filtered/sorted on screen (search +
    // genre + the existing performance-count sort) so prev/next on the
    // profile matches what was actually being browsed, not some other
    // default order. sessionStorage not state/context - survives the
    // full-page navigation a Link/router.push does, cleared naturally
    // on browser close, no size concern (id list only, not full
    // records).
    try {
      sessionStorage.setItem('afa-artist-nav-order', JSON.stringify(filtered.map((a) => a.id)))
    } catch {
      // Storage can fail (private browsing, quota) - navigation still
      // works, the profile page just falls back to its own default
      // order.
    }
    startTransition(() => {
      router.push(`/artists/${id}`)
    })
  }

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
        (a.user.displayName || a.user.name).toLowerCase().includes(search.toLowerCase()) ||
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
    <main style={{ minHeight: "100vh", background: "var(--afa-cream)", fontFamily: "var(--font-sans)" }}>
      <SiteNav active="artists" />

      {/* HERO - font tokens brought in line with the homepage's actual
          Newsreader/Manrope/IBM Plex Mono setup (FEAT-2608-044); this
          page was still hardcoded to Georgia/system-ui, the exact
          "inconsistent typography" gap named in BUG-2607-036. */}
      <div style={{ background: "var(--afa-ink)", padding: "56px 48px", position: "relative", overflow: "hidden" }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: 0.04, pointerEvents: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", mixBlendMode: "screen" }} />
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center", position: "relative" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 700, color: "white", marginBottom: "8px", lineHeight: 1.1 }}>
            {tr.artistsPage.heroPrefix}<em style={{ color: "var(--afa-terracotta)", fontStyle: "italic", fontWeight: 500 }}>{tr.artistsPage.heroEmphasis}</em>{tr.artistsPage.heroSuffix}
          </div>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "16px", color: "rgba(255,255,255,0.5)", marginBottom: "32px" }}>
            {loading ? tr.artistsPage.loadingArtists : tr.artistsPage.countPerforming.replace("{n}", String(filtered.length))}
          </p>
          <BrowseSearchDropdown
            query={search}
            items={filtered}
            getId={(a) => a.id}
            emptyLabel={tr.common.nounArtists}
            translate
            onSelect={(a) => goToArtist(a.id)}
            renderRow={(a) => (
              <>
                <span style={{ fontWeight: 600 }}>{a.user.displayName || a.user.name}</span>
                {a.genre.length > 0 && <span style={{ opacity: 0.5, marginLeft: "8px" }}>{a.genre.join(", ")}</span>}
              </>
            )}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr.artistsPage.searchPlaceholder}
              style={{ width: "100%", padding: "18px 56px 18px 20px", borderRadius: "10px", border: "none", fontSize: "16px", fontFamily: "var(--font-sans)", background: "white", color: "var(--afa-ink)", outline: "none", boxSizing: "border-box" }}
            />
            <span style={{ position: "absolute", right: "20px", top: "50%", transform: "translateY(-50%)", fontSize: "20px" }}>🔍</span>
          </BrowseSearchDropdown>
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
                style={{ padding: "7px 14px", borderRadius: "99px", border: `1.5px solid ${selectedGenre === g ? "var(--afa-terracotta)" : "rgba(14,12,10,0.12)"}`, background: selectedGenre === g ? "var(--afa-terracotta)" : "transparent", color: selectedGenre === g ? "white" : "var(--afa-ink)", fontSize: "13px", fontWeight: 500, fontFamily: "var(--font-sans)", cursor: "pointer" }}
              >
                {g === "All" ? tr.artistsPage.filterAll : g}
              </button>
            ))}
          </div>
        </div>

        {/* RISING STAR */}
        {risingStar && (
          <div style={{ background: "linear-gradient(135deg, var(--afa-maroon-black), var(--afa-terracotta))", borderRadius: "16px", padding: "24px 32px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "56px" }}>🌟</div>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: "4px" }}>{tr.artistsPage.topArtistNow}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700, color: "white", marginBottom: "4px" }}>{risingStar.user.displayName || risingStar.user.name}</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "rgba(255,255,255,0.65)" }}>{risingStar._count.performances} {risingStar._count.performances === 1 ? tr.artistsPage.showsSingular : tr.artistsPage.showsPlural}</div>
            </div>
            <button
              onClick={() => goToArtist(risingStar.id)}
              disabled={!!navigatingId}
              style={{ background: "white", color: "var(--afa-terracotta)", padding: "12px 24px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, fontFamily: "var(--font-sans)", border: "none", cursor: navigatingId ? "default" : "pointer", whiteSpace: "nowrap", opacity: navigatingId && navigatingId !== risingStar.id ? 0.5 : 1 }}
            >
              {navigatingId === risingStar.id ? tr.artistsPage.loadingEllipsis : tr.artistsPage.viewProfile}
            </button>
          </div>
        )}

        {/* ARTIST GRID */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--afa-ink)", opacity: 0.5, fontFamily: "var(--font-sans)" }}>{tr.artistsPage.loadingArtists}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: "64px", marginBottom: "16px" }}>🎤</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "8px" }}>
              {artists.length === 0 ? tr.artistsPage.emptyNoneYetTitle : tr.artistsPage.emptyNoneFoundTitle}
            </div>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--afa-ink)", opacity: 0.5 }}>
              {artists.length === 0 ? tr.artistsPage.emptyNoneYetSub : tr.artistsPage.emptyNoneFoundSub}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
            {filtered.map((artist) => {
              const isNavigatingThis = navigatingId === artist.id
              const displayName = artist.user.displayName || artist.user.name
              // 11 Aug (Hitesh live click-test): 100/408 QA artists have
              // a GitHub avatars URL as their avatar (dev/test filler,
              // not a photo) - shown live as Sai Jain's "portrait" being
              // literally the GitHub mascot. isPlaceholderImageUrl treats
              // these as no-photo so they fall through to the monogram.
              const portraitUrl = artist.user.avatar && !isPlaceholderImageUrl(artist.user.avatar) ? artist.user.avatar : null
              return (
                <div
                  key={artist.id}
                  role="link"
                  tabIndex={0}
                  aria-busy={isNavigatingThis}
                  onClick={() => goToArtist(artist.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      goToArtist(artist.id)
                    }
                  }}
                  className="hover-lift-card afa-focusable"
                  style={{
                    background: "white",
                    borderRadius: "10px",
                    overflow: "hidden",
                    border: "1px solid rgba(14,12,10,0.08)",
                    position: "relative",
                    cursor: navigatingId ? "default" : "pointer",
                    opacity: navigatingId && !isNavigatingThis ? 0.5 : 1,
                    transition: "opacity 0.15s ease",
                  }}
                >
                  {isNavigatingThis && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 2,
                        background: "rgba(255,255,255,0.7)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          border: "3px solid rgba(14,12,10,0.15)",
                          borderTopColor: "var(--afa-terracotta)",
                          animation: "afa-spin 0.7s linear infinite",
                        }}
                      />
                      <style>{`@keyframes afa-spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                  )}

                  {/* PORTRAIT - user.avatar was previously shrunk into a
                      72px circle inside a plum-black header strip. 301 of
                      401 QA avatars are real uploaded photos, promoted to
                      a full portrait (same photo-first grammar as the
                      redesigned venue card) with the badge overlaid via
                      the photo instead of a header bar. The other 100 are
                      a GitHub avatars URL (dev/test filler) -
                      isPlaceholderImageUrl above filters those out so
                      they fall back to the monogram rather than showing
                      the GitHub mascot as someone's portrait. Also true
                      for 100% of no-avatar artists in QA - monogramTone
                      rotates through the same dark-tone palette as the
                      venue card so a grid of fallbacks stays varied. */}
                  <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", background: portraitUrl ? "var(--afa-plum-black)" : monogramTone(artist.id), overflow: "hidden" }}>
                    {portraitUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={portraitUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <>
                        <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: 0.06, pointerEvents: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", mixBlendMode: "screen" }} />
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: "48px", fontStyle: "italic", color: "rgba(247,243,238,0.35)" }}>
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      </>
                    )}
                    {artist.sceneStatus && CARD_BADGE[artist.sceneStatus] && (
                      <span
                        style={{
                          position: "absolute",
                          top: "12px",
                          right: "12px",
                          fontFamily: "var(--font-sans)",
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "3px 10px",
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

                  {/* WALL-LABEL - same mono/gold/diamond caption device as
                      the redesigned venue card, genre + shows count in
                      place of city + capacity. */}
                  <div style={{ padding: "10px 18px 0", fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--afa-gold)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>{artist.genre.length > 0 ? artist.genre.slice(0, 2).join(" / ") : tr.artistsPage.genreNotSet}</span>
                    <span style={{ color: "var(--afa-terracotta)" }}>◆</span>
                    <span>{artist._count.performances} {artist._count.performances === 1 ? tr.artistsPage.showsSingular : tr.artistsPage.showsPlural}</span>
                  </div>

                  <div style={{ padding: "6px 18px 18px" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "10px" }}>{displayName}</div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", minHeight: "24px" }}>
                      {artist.styleTag.map((tag) => (
                        <span key={tag} style={{ fontFamily: "var(--font-sans)", background: "var(--afa-cream)", color: "var(--afa-ink)", fontSize: "11px", padding: "3px 10px", borderRadius: "99px", fontWeight: 500 }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
