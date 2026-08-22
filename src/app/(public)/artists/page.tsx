"use client"
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import SiteNav from "@/components/SiteNav"
import BrowseSearchDropdown from "@/components/BrowseSearchDropdown"
import SearchInputBox from "@/components/SearchInputBox"
import Photo from "@/components/Photo"
import ArtistNoPhoto from "@/components/ArtistNoPhoto"
import { isPlaceholderImageUrl } from "@/lib/placeholder-image"
import { useLocale } from "@/lib/i18n/translate"
import { SearchIcon, SparkIcon, ArrowIcon } from "@/components/icons/ArtistIcons"

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
const CARD_BADGE: Partial<Record<SceneStatusTier, { label: string; bg: string; color: string; border?: string }>> = {
  HEADLINER: { label: "★ Headliner", bg: "var(--afa-fill-solid)", color: "var(--afa-on-fill-solid)" },
  FEATURED: { label: "Featured", bg: "rgba(201,151,58,0.18)", color: "var(--afa-amber)", border: "1px solid var(--afa-amber)" },
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
  // BUG-2608-079 - a dead portrait URL previously left Photo rendering a
  // broken image instead of falling back to ArtistNoPhoto. Grid cards are
  // rendered inline in a .map() rather than as their own component, so
  // failures there are tracked per artist id in one Set; the featured
  // "rising star" card is a single item, so a plain boolean is enough.
  const [risingStarPhotoFailed, setRisingStarPhotoFailed] = useState(false)
  const [failedPhotoIds, setFailedPhotoIds] = useState<Set<string>>(new Set())

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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load artists")
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

  const risingStarPortraitUrl =
    risingStar?.user.avatar && !isPlaceholderImageUrl(risingStar.user.avatar) ? risingStar.user.avatar : null

  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-surface-page)", fontFamily: "var(--font-sans)" }}>
      <style>{`
        @keyframes afa-spin { to { transform: rotate(360deg); } }
        .afa-artist-card { transition: transform 0.25s ease, border-color 0.25s ease; }
        .afa-artist-card:hover, .afa-artist-card:focus-visible { transform: translateY(-3px); border-color: rgba(201,151,58,0.45) !important; outline: none; }
        .afa-genre-filter { position: relative; padding-bottom: 4px; background: none; border: none; cursor: pointer; }
        .afa-genre-filter::after { content: ""; position: absolute; left: 0; bottom: 0; height: 1px; width: 100%; background: var(--afa-amber); opacity: 0.5; transform: scaleX(0); transform-origin: left; transition: transform 0.25s ease; }
        .afa-genre-filter:hover::after { transform: scaleX(1); }
        .afa-cta-solid { transition: filter 0.15s ease; }
        .afa-cta-solid:hover { filter: brightness(1.1); }
        /* HERO (BUG-2608-080, then GEN-2608-078, then GEN-2608-079) - export
           App.tsx Directory component lines 478-509 has a left-aligned
           two-column grid (items-end, lg:grid-cols-[1fr_auto]) with the
           subtitle beside the headline and a static "The directory"
           eyebrow, then a separate border-y stat+search row below with its
           own live count. GEN-2608-078 deliberately diverges from that
           export structure for cross-page consistency with Events/Venues,
           which lead their hero with a stat-forward eyebrow ("0 EVENTS
           HAPPENING NEAR YOU", "Directory · 1140 spaces") and stack the
           subtitle full-width below the headline rather than beside it.
           The eyebrow now carries the live artist count
           (tr.artistsPage.eyebrowDirectory, was static "The directory");
           the subtitle moved out of the grid to sit under the headline;
           and the lower stat+search row dropped its now-duplicate count,
           keeping only the search box - repeating the same number twice in
           one hero read as the page not being sure which one was
           authoritative, and Events/Venues don't repeat their headline
           count elsewhere either. This is a source-checked, source-
           deviating choice (like BUG-2608-080's no-forced-<br/> call), not
           a fidelity fix - the export's two-column grid and static eyebrow
           are left as-is in the reference file.

           GEN-2608-079 REVERSES part of GEN-2608-078's own finding, at
           Hitesh's explicit direction - not a fidelity correction.
           GEN-2608-078's source check was correct (the export's h1 is
           uniform #f5f5f0, no span/em, no amber) and concluded there was
           no source backing to add amber to the headline. Hitesh has since
           directed a deliberate deviation from the export on exactly that
           point: heroEmphasis ("Artists") is now colored var(--afa-amber),
           matching the payoff-word-gets-amber pattern Events ("Nights
           worth showing up for") and Venues ("Where the show happens")
           both use - amber on the middle/payoff word, never the lead word,
           which is why heroPrefix ("Discover ") stays plain cream. Also
           removed the h1's own maxWidth: 560px, which (combined with the
           clamp(48px,9vw,112px) sizing) was forcing "Discover"/"Artists"
           onto two lines even without a literal <br/> - Events/Venues both
           render their headline on one line. Verified via real screenshots
           at 390/768/1024/1280/1440px that clamp(48px,8vw,96px) - reduced
           from the original 112px upper bound - stays single-line at every
           one of those widths with no awkward tablet/narrow-desktop break,
           including locales where heroPrefix is empty and heroEmphasis
           leads the phrase (e.g. Hindi "कलाकारों को खोजें" - amber noun,
           cream trailing verb). */
        .afa-artists-hero-grid { display: flex; flex-direction: column; gap: 16px; }
        .afa-artists-hero-subtitle { max-width: 560px; }
        .afa-artists-stat-row { display: flex; flex-direction: column; align-items: flex-start; gap: 20px; }
        @media (min-width: 768px) { .afa-artists-stat-row { flex-direction: row; align-items: center; justify-content: space-between; } }
        /* BUG-2608-074: featured artist card was a fixed 2-column grid
           (photo | name+button) with no mobile breakpoint - on phone
           widths the 240px-min photo column left almost no room for the
           text column, clipping the name and "View Profile" button.
           Same root-cause pattern as BUG-2608-070's Ledger grid. */
        @media (max-width: 700px) {
          .afa-featured-artist-card { grid-template-columns: 1fr !important; }
          .afa-featured-artist-card .afa-featured-artist-photo { min-height: 200px !important; }
          .afa-featured-artist-card .afa-featured-artist-content { padding: 20px 20px 24px !important; }
        }
      `}</style>
      <SiteNav active="artists" />

      {/* HERO */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 24px 0" }}>
        <div className="afa-artists-hero-grid">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--afa-amber)" }}>
            {loading ? tr.artistsPage.loadingArtists : tr.artistsPage.eyebrowDirectory.replace("{n}", String(filtered.length))}
          </span>
          <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "clamp(48px, 8vw, 96px)", lineHeight: 0.9, color: "var(--afa-cream)" }}>
            {tr.artistsPage.heroPrefix}
            <span style={{ color: "var(--afa-amber)" }}>{tr.artistsPage.heroEmphasis}</span>
            {tr.artistsPage.heroSuffix}
          </h1>
          <p className="afa-artists-hero-subtitle" style={{ fontFamily: "var(--font-sans)", fontSize: "15px", lineHeight: 1.6, color: "rgba(245,245,240,0.65)" }}>
            {tr.artistsPage.heroSubtitle}{" "}
            <span style={{ color: "var(--afa-cream)" }}>{tr.artistsPage.heroSubtitleEmphasis}</span>
          </p>
        </div>

        <div className="afa-artists-stat-row" style={{ marginTop: "40px", borderTop: "1px solid rgba(245,245,240,0.1)", borderBottom: "1px solid rgba(245,245,240,0.1)", padding: "20px 0" }}>
          <div style={{ flex: "1 1 280px" }}>
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
              <SearchInputBox
                value={search}
                onChange={setSearch}
                placeholder={tr.artistsPage.searchPlaceholder}
                style={{ width: "100%" }}
              />
            </BrowseSearchDropdown>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
        {error && (
          <div style={{ padding: "14px 16px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--afa-error)", borderRadius: "8px", color: "var(--afa-error)", fontSize: "14px", marginBottom: "24px" }}>
            {error}
          </div>
        )}

        {/* FILTERS - editorial underline row, not pill-chip buttons */}
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "baseline", marginBottom: "24px", borderBottom: "1px solid rgba(245,245,240,0.1)", paddingBottom: "18px" }}>
          {["All", ...genres].map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(g)}
              className="afa-genre-filter"
              style={{
                fontFamily: "var(--font-display)",
                fontStyle: "italic",
                fontSize: "16px",
                color: selectedGenre === g ? "var(--afa-cream)" : "rgba(245,245,240,0.4)",
              }}
            >
              {g === "All" ? tr.artistsPage.filterAll : g}
              {selectedGenre === g && (
                <span style={{ position: "absolute", left: 0, bottom: 0, height: "1px", width: "100%", background: "var(--afa-fill-solid)" }} />
              )}
            </button>
          ))}
        </div>

        {/* FEATURED / RISING STAR */}
        {risingStar && (
          <div className="afa-featured-artist-card" style={{ background: "var(--afa-surface-raised)", border: "1px solid rgba(245,245,240,0.1)", borderRadius: "16px", overflow: "hidden", marginBottom: "24px", display: "grid", gridTemplateColumns: "minmax(240px, 1.1fr) 1fr" }}>
            <div className="afa-featured-artist-photo" style={{ position: "relative", minHeight: "260px" }}>
              {risingStarPortraitUrl && !risingStarPhotoFailed ? (
                <Photo src={risingStarPortraitUrl} alt={risingStar.user.displayName || risingStar.user.name} onError={() => setRisingStarPhotoFailed(true)} />
              ) : (
                <ArtistNoPhoto name={risingStar.user.displayName || risingStar.user.name} genres={risingStar.genre} size="card" />
              )}
              <div style={{ position: "absolute", top: "16px", left: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <SparkIcon style={{ width: "16px", height: "16px", color: "var(--afa-fill-solid)" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--afa-cream)", textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>
                  {tr.artistsPage.topArtistNow}
                </span>
              </div>
            </div>
            <div className="afa-featured-artist-content" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "16px" }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "clamp(24px, 3vw, 32px)", fontWeight: 600, color: "var(--afa-cream)", marginBottom: "6px" }}>
                  {risingStar.user.displayName || risingStar.user.name}
                </div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "rgba(245,245,240,0.6)" }}>
                  {risingStar._count.performances} {risingStar._count.performances === 1 ? tr.artistsPage.showsSingular : tr.artistsPage.showsPlural}
                </div>
              </div>
              <button
                onClick={() => goToArtist(risingStar.id)}
                disabled={!!navigatingId}
                className="afa-cta-solid"
                style={{ display: "inline-flex", alignItems: "center", gap: "8px", width: "fit-content", background: "var(--afa-fill-solid)", color: "var(--afa-on-fill-solid)", padding: "12px 24px", borderRadius: "999px", fontSize: "13px", fontWeight: 700, fontFamily: "var(--font-sans)", border: "none", cursor: navigatingId ? "default" : "pointer", opacity: navigatingId && navigatingId !== risingStar.id ? 0.5 : 1 }}
              >
                {navigatingId === risingStar.id ? tr.artistsPage.loadingEllipsis : tr.artistsPage.viewProfile}
                <ArrowIcon style={{ width: "14px", height: "14px" }} />
              </button>
            </div>
          </div>
        )}

        {/* ARTIST GRID */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--afa-text-primary)", opacity: 0.5, fontFamily: "var(--font-sans)" }}>{tr.artistsPage.loadingArtists}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <SearchIcon style={{ width: "32px", height: "32px", color: "var(--afa-amber)", marginBottom: "16px" }} />
            <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "8px" }}>
              {artists.length === 0 ? tr.artistsPage.emptyNoneYetTitle : tr.artistsPage.emptyNoneFoundTitle}
            </div>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--afa-text-primary)", opacity: 0.5 }}>
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
              // these as no-photo so they fall through to the fallback.
              const portraitUrl = failedPhotoIds.has(artist.id) ? null : artist.user.avatar && !isPlaceholderImageUrl(artist.user.avatar) ? artist.user.avatar : null
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
                  className="afa-artist-card"
                  style={{
                    background: "var(--afa-surface-raised)",
                    borderRadius: "10px",
                    overflow: "hidden",
                    border: "1px solid rgba(245,245,240,0.1)",
                    position: "relative",
                    cursor: navigatingId ? "default" : "pointer",
                    opacity: navigatingId && !isNavigatingThis ? 0.5 : 1,
                    transition: "opacity 0.15s ease, transform 0.25s ease, border-color 0.25s ease",
                  }}
                >
                  {isNavigatingThis && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 2,
                        background: "rgba(10,10,10,0.7)",
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
                          border: "3px solid rgba(245,245,240,0.15)",
                          borderTopColor: "var(--afa-fill-solid)",
                          animation: "afa-spin 0.7s linear infinite",
                        }}
                      />
                    </div>
                  )}

                  {/* PORTRAIT - real photos go through Photo.tsx's amber
                      duotone treatment; no-photo artists get the
                      genre-relevant illustrated mark + large italic name
                      (ArtistNoPhoto) instead of the old circular monogram
                      letter. isPlaceholderImageUrl above filters GitHub
                      avatars / picsum URLs (dev/test filler, not real
                      photos - confirmed live by Hitesh, Sai Jain's
                      "portrait" was literally the GitHub mascot) so they
                      correctly fall through to the no-photo path too. */}
                  <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", overflow: "hidden" }}>
                    {portraitUrl ? (
                      <Photo src={portraitUrl} alt={displayName} onError={() => setFailedPhotoIds((prev) => new Set(prev).add(artist.id))} />
                    ) : (
                      <ArtistNoPhoto
                        name={displayName}
                        genres={artist.genre}
                        caption={`${artist.genre[0] ?? tr.artistsPage.genreNotSet} — ${tr.artistsPage.noPhotoCaption}`}
                      />
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
                          border: CARD_BADGE[artist.sceneStatus]!.border ?? "none",
                        }}
                      >
                        {CARD_BADGE[artist.sceneStatus]!.label}
                      </span>
                    )}
                  </div>

                  {/* WALL-LABEL - mono/amber/diamond caption device,
                      genre + shows count. */}
                  <div style={{ padding: "10px 18px 0", fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--afa-amber)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>{artist.genre.length > 0 ? artist.genre.slice(0, 2).join(" / ") : tr.artistsPage.genreNotSet}</span>
                    <span>◆</span>
                    <span>{artist._count.performances} {artist._count.performances === 1 ? tr.artistsPage.showsSingular : tr.artistsPage.showsPlural}</span>
                  </div>

                  <div style={{ padding: "6px 18px 18px" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "10px" }}>{displayName}</div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", minHeight: "24px" }}>
                      {artist.styleTag.map((tag) => (
                        <span key={tag} style={{ fontFamily: "var(--font-sans)", background: "rgba(245,245,240,0.08)", color: "var(--afa-text-primary)", fontSize: "11px", padding: "3px 10px", borderRadius: "99px", fontWeight: 500 }}>{tag}</span>
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
