"use client"
import { useState, useEffect, type TouchEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import SiteNav from "@/components/SiteNav"
import AuthPromptSheet from "@/components/AuthPromptSheet"
import type { SceneStatusTier } from "@/lib/scene-status"

interface Performance {
  id: string
  slot: number
  duration: number
  event: {
    id: string
    title: string
    date: string
    isFree: boolean
    ticketPrice: number | null
    venue: { name: string; city: string } | null
  }
}

interface ArtistData {
  id: string
  bio: string
  genre: string[]
  styleTag: string[]
  socialLinks: Record<string, string> | null
  videoReel: string[]
  tagline: string | null
  fullBiography: string | null
  journey: string | null
  influences: string | null
  acknowledgments: string | null
  goals: string | null
  tourStops?: { id: string; city: string; country: string; date: string | null; link: string | null }[]
  user: { name: string; displayName: string | null; avatar: string | null }
  performances: Performance[]
  _count: { performances: number; followers: number }
  verifiedAttendees: number
  repeatAttendees: number
}

const SOCIAL_ICON: Record<string, string> = {
  instagram: "📸",
  youtube: "▶️",
  twitter: "🐦",
}

export default function ArtistProfilePage({
  artist,
  isVerified,
  sceneStatus,
}: {
  artist: ArtistData | null
  isVerified?: boolean
  sceneStatus?: SceneStatusTier | null
}) {
  const [activeTab, setActiveTab] = useState<"about" | "shows">("about")
  const { status: sessionStatus } = useSession()
  const [following, setFollowing] = useState(false)
  const [notifyEnabled, setNotifyEnabledState] = useState(true)
  const [followerCount, setFollowerCount] = useState(artist?._count.followers ?? 0)
  const [followBusy, setFollowBusy] = useState(false)
  const [showAuthSheet, setShowAuthSheet] = useState(false)
  const router = useRouter()

  // Feedback cmsaicfav (2 Aug) - swipe left/right (mobile) / arrow keys
  // (desktop) to move to the previous/next artist without going back to
  // the listing. Follow-up to the same pattern piloted on the Feedback
  // admin panel (PR #327) - this is the "full-page detail view" version
  // that pilot deliberately deferred, since each artist has its own URL
  // and "next" has to mean something specific: the order the person was
  // actually browsing in, not an arbitrary default.
  //
  // /artists stashes its currently filtered/sorted id list into
  // sessionStorage right before navigating here (see goToArtist in
  // page.tsx). If that's present and includes this artist, it's used
  // as-is - swiping through respects whatever search/genre filter was
  // active. If it's missing or stale (direct link, deep link, or a
  // filtered-out artist), falls back to the same default order the
  // listing's own API already returns (ordered by performance count),
  // so prev/next still works, just without a specific filter to honor.
  const [navOrder, setNavOrder] = useState<string[] | null>(null)
  const [navigating, setNavigating] = useState(false)

  useEffect(() => {
    if (!artist) return
    let cancelled = false

    const useFallback = async () => {
      try {
        const res = await fetch('/api/artists')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data)) {
          setNavOrder(data.map((a: { id: string }) => a.id))
        }
      } catch {
        // No nav order - prev/next bar just won't render, rest of the
        // page is unaffected.
      }
    }

    try {
      const raw = sessionStorage.getItem('afa-artist-nav-order')
      if (raw) {
        const stashed = JSON.parse(raw)
        if (Array.isArray(stashed) && stashed.includes(artist.id)) {
          setNavOrder(stashed)
          return
        }
      }
    } catch {
      // Fall through to fallback fetch below.
    }
    useFallback()

    return () => {
      cancelled = true
    }
  }, [artist])

  useEffect(() => {
    setNavigating(false)
  }, [artist?.id])

  const navIndex = navOrder && artist ? navOrder.indexOf(artist.id) : -1
  const prevArtistId = navOrder && navIndex > 0 ? navOrder[navIndex - 1] : null
  const nextArtistId = navOrder && navIndex >= 0 && navIndex < navOrder.length - 1 ? navOrder[navIndex + 1] : null

  // BUG-2608-025 (10 Aug) - each prev/next hop took 2-3s. Two causes, both
  // fixed together: (1) the server page did 4 sequential DB round-trips
  // per artist (see page.tsx) with no parallelization, and (2) router.push
  // alone doesn't prefetch the way <Link> does, so every hop paid the
  // full RSC fetch+render cost with nothing pre-warmed. Prefetching both
  // neighbors as soon as they're known means the RSC payload for whichever
  // one gets clicked is usually already in flight or cached by the time
  // the person acts.
  useEffect(() => {
    if (prevArtistId) router.prefetch(`/artists/${prevArtistId}`)
    if (nextArtistId) router.prefetch(`/artists/${nextArtistId}`)
  }, [prevArtistId, nextArtistId, router])

  const goToPrevArtist = () => {
    if (navigating || !prevArtistId) return
    setNavigating(true)
    router.push(`/artists/${prevArtistId}`)
  }
  const goToNextArtist = () => {
    if (navigating || !nextArtistId) return
    setNavigating(true)
    router.push(`/artists/${nextArtistId}`)
  }

  useEffect(() => {
    if (!navOrder) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTyping = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (isTyping) return
      if (e.key === 'ArrowLeft') goToPrevArtist()
      if (e.key === 'ArrowRight') goToNextArtist()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navOrder, navigating, prevArtistId, nextArtistId])

  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null)
  const SWIPE_THRESHOLD_PX = 60
  const handleProfileTouchStart = (e: TouchEvent) => {
    setTouchStartPos({ x: e.touches[0].clientX, y: e.touches[0].clientY })
  }
  const handleProfileTouchEnd = (e: TouchEvent) => {
    if (!touchStartPos) return
    const dx = e.changedTouches[0].clientX - touchStartPos.x
    const dy = e.changedTouches[0].clientY - touchStartPos.y
    setTouchStartPos(null)
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return
    if (dx > 0) goToPrevArtist()
    else goToNextArtist()
  }

  useEffect(() => {
    if (!artist) return
    fetch(`/api/artists/${artist.id}/follow`)
      .then((res) => res.json())
      .then((data) => {
        setFollowing(data.following)
        setNotifyEnabledState(data.notifyEnabled)
      })
      .catch(() => {})
  }, [artist])

  const toggleFollow = async () => {
    if (!artist) return
    if (sessionStatus !== "authenticated") {
      setShowAuthSheet(true)
      return
    }
    setFollowBusy(true)
    try {
      const res = await fetch(`/api/artists/${artist.id}/follow`, { method: "POST" })
      const data = await res.json()
      setFollowing(data.following)
      setNotifyEnabledState(data.notifyEnabled)
      setFollowerCount((prev) => prev + (data.following ? 1 : -1))
    } finally {
      setFollowBusy(false)
    }
  }

  const toggleNotify = async () => {
    if (!artist || followBusy) return
    setFollowBusy(true)
    try {
      const next = !notifyEnabled
      const res = await fetch(`/api/artists/${artist.id}/follow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyEnabled: next }),
      })
      const data = await res.json()
      setNotifyEnabledState(data.notifyEnabled)
    } finally {
      setFollowBusy(false)
    }
  }

  if (!artist) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--afa-cream)", fontFamily: "system-ui, sans-serif" }}>
        <SiteNav backHref="/artists" backLabel="← Back to Artists" />
        <div style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px" }}>Artist not found.</div>
      </main>
    )
  }

  const now = new Date(new Date().toDateString())
  const upcomingShows = artist.performances
    .filter((p) => new Date(p.event.date) >= now)
    .sort((a, b) => new Date(a.event.date).getTime() - new Date(b.event.date).getTime())
  const pastShows = artist.performances
    .filter((p) => new Date(p.event.date) < now)
    .sort((a, b) => new Date(b.event.date).getTime() - new Date(a.event.date).getTime())

  const socialEntries = Object.entries(artist.socialLinks || {}).filter(([, v]) => v)
  const displayName = artist.user.displayName || artist.user.name

  return (
    <main
      style={{ minHeight: "100vh", background: "var(--afa-cream)", fontFamily: "system-ui, sans-serif" }}
      onTouchStart={handleProfileTouchStart}
      onTouchEnd={handleProfileTouchEnd}
    >
      <SiteNav backHref="/artists" backLabel="← Back to Artists" />

      {navOrder && navIndex >= 0 && (
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "10px 24px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: "16px" }}>
          <button
            onClick={goToPrevArtist}
            disabled={!prevArtistId}
            aria-label="Previous artist"
            style={{
              background: prevArtistId ? "var(--afa-terracotta)" : "var(--afa-white)",
              border: prevArtistId ? "none" : "1px solid rgba(14,12,10,0.13)",
              borderRadius: "999px",
              width: "34px",
              height: "34px",
              fontSize: "16px",
              fontWeight: 700,
              cursor: prevArtistId ? "pointer" : "default",
              opacity: prevArtistId ? 1 : 0.35,
              color: prevArtistId ? "white" : "var(--afa-ink)",
              boxShadow: prevArtistId ? "0 2px 6px rgba(196,90,52,0.35)" : "none",
            }}
          >
            ‹
          </button>
          <span style={{ fontSize: "12px", color: "var(--afa-taupe, #8a8078)" }}>
            Artist {navIndex + 1} of {navOrder.length}
          </span>
          <button
            onClick={goToNextArtist}
            disabled={!nextArtistId}
            aria-label="Next artist"
            style={{
              background: nextArtistId ? "var(--afa-terracotta)" : "var(--afa-white)",
              border: nextArtistId ? "none" : "1px solid rgba(14,12,10,0.13)",
              borderRadius: "999px",
              width: "34px",
              height: "34px",
              fontSize: "16px",
              fontWeight: 700,
              cursor: nextArtistId ? "pointer" : "default",
              opacity: nextArtistId ? 1 : 0.35,
              color: nextArtistId ? "white" : "var(--afa-ink)",
              boxShadow: nextArtistId ? "0 2px 6px rgba(196,90,52,0.35)" : "none",
            }}
          >
            ›
          </button>
        </div>
      )}

      {/* HERO */}
      <div style={{ background: "var(--afa-plum-black)", padding: "64px 48px 40px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", gap: "32px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ width: "140px", height: "140px", borderRadius: "50%", background: artist.user.avatar ? `url(${artist.user.avatar}) center/cover` : "rgba(255,255,255,0.1)", border: "4px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "56px", fontWeight: 700, color: "white", flexShrink: 0 }}>
            {!artist.user.avatar && displayName.charAt(0).toUpperCase()}
          </div>

          <div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
              {artist.genre.map((g) => (
                <span key={g} style={{ background: "var(--afa-terracotta)", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: "4px" }}>{g.toUpperCase()}</span>
              ))}
            </div>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 900, color: "white", lineHeight: 1.05, marginBottom: "12px", letterSpacing: "-1px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {displayName}
              {isVerified && (
                <span
                  title="Verified: complete profile with an established track record"
                  style={{ fontSize: "0.45em", background: "var(--afa-social-blue)", color: "white", width: "1.1em", height: "1.1em", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                >
                  ✓
                </span>
              )}
              {sceneStatus && sceneStatus !== "NEW_EMERGING" && (
                <span
                  title={
                    sceneStatus === "HEADLINER"
                      ? "Headliner — admin-recognized, earned through track record and reputation"
                      : sceneStatus === "FEATURED"
                      ? "Featured — vouched for by multiple organisers"
                      : "Rising — building a strong track record"
                  }
                  style={{
                    fontSize: "0.32em",
                    fontWeight: 700,
                    padding: "0.35em 0.7em",
                    borderRadius: "999px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3em",
                    flexShrink: 0,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    background:
                      sceneStatus === "HEADLINER"
                        ? "var(--afa-gold)"
                        : sceneStatus === "FEATURED"
                        ? "rgba(201,151,58,0.2)"
                        : "rgba(255,255,255,0.12)",
                    color: sceneStatus === "HEADLINER" ? "var(--afa-plum-black)" : sceneStatus === "FEATURED" ? "var(--afa-gold)" : "rgba(255,255,255,0.85)",
                    border: sceneStatus === "FEATURED" ? "1px solid var(--afa-gold)" : "none",
                  }}
                >
                  {sceneStatus === "HEADLINER" ? "★ Headliner" : sceneStatus === "FEATURED" ? "Featured" : "Rising"}
                </span>
              )}
            </h1>
            {artist.tagline && (
              <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.75)", fontStyle: "italic", marginBottom: "12px", maxWidth: "500px" }}>
                &quot;{artist.tagline}&quot;
              </p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <button
                onClick={toggleFollow}
                disabled={followBusy}
                style={{
                  fontSize: "13px", fontWeight: 700, padding: "8px 20px", borderRadius: "6px", cursor: "pointer",
                  border: following ? "1.5px solid rgba(255,255,255,0.4)" : "none",
                  background: following ? "transparent" : "var(--afa-terracotta)",
                  color: "white",
                  opacity: followBusy ? 0.6 : 1,
                }}
              >
                {following ? "✓ Following" : "+ Follow"}
              </button>
              {following && (
                <button
                  onClick={toggleNotify}
                  disabled={followBusy}
                  aria-label={notifyEnabled ? "Mute new event notifications" : "Get notified of new events"}
                  title={notifyEnabled ? "Notifications on - tap to mute" : "Notifications off - tap to enable"}
                  style={{
                    width: "34px", height: "34px", borderRadius: "50%",
                    border: "1.5px solid rgba(255,255,255,0.4)",
                    background: notifyEnabled ? "rgba(200,68,26,0.3)" : "transparent",
                    fontSize: "15px", cursor: followBusy ? "default" : "pointer",
                    opacity: followBusy ? 0.6 : 1,
                  }}
                >
                  {notifyEnabled ? "🔔" : "🔕"}
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {artist.styleTag.map((tag) => (
                <span key={tag} style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", fontSize: "12px", padding: "4px 12px", borderRadius: "99px", border: "1px solid rgba(255,255,255,0.15)" }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{ background: "white", borderBottom: "1px solid rgba(14,12,10,0.08)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px 48px", display: "flex", gap: "48px", flexWrap: "wrap" }}>
          {[
            { num: followerCount, label: "Followers" },
            {
              num: artist.verifiedAttendees,
              label: "Verified Attendees",
              title: "Audience accounts who checked in at a show this artist performed at",
              extra: artist.repeatAttendees > 0 ? `${artist.repeatAttendees} repeat` : null,
            },
            { num: artist._count.performances, label: "Total Shows" },
            { num: upcomingShows.length, label: "Upcoming" },
          ].map((stat) => (
            <div key={stat.label} title={"title" in stat ? stat.title : undefined}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "var(--afa-ink)", lineHeight: 1 }}>{stat.num}</div>
              <div style={{ fontSize: "12px", color: "var(--afa-ink)", opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "4px" }}>
                {stat.label}
                {"extra" in stat && stat.extra && <span style={{ opacity: 0.7 }}> · {stat.extra}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .artist-detail-grid { grid-template-columns: 1fr 320px; }
        @media (max-width: 900px) {
          .artist-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div className="artist-detail-grid" style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 48px", display: "grid", gap: "32px" }}>
        {/* LEFT */}
        <div>
          <div style={{ display: "flex", gap: "0", marginBottom: "32px", borderBottom: "2px solid rgba(14,12,10,0.1)" }}>
            {(["about", "shows"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{ padding: "12px 24px", border: "none", background: "transparent", fontSize: "14px", fontWeight: 600, color: activeTab === tab ? "var(--afa-terracotta)" : "var(--afa-ink)", cursor: "pointer", borderBottom: `2px solid ${activeTab === tab ? "var(--afa-terracotta)" : "transparent"}`, marginBottom: "-2px", textTransform: "capitalize" }}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "about" && (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "12px" }}>About</h2>
              <p style={{ fontSize: "15px", lineHeight: 1.8, color: "var(--afa-ink)", opacity: artist.bio ? 0.75 : 0.4, marginBottom: "32px", fontStyle: artist.bio ? "normal" : "italic" }}>
                {artist.bio || "This artist hasn't added a bio yet."}
              </p>

              {[
                { label: "Full Biography", value: artist.fullBiography },
                { label: "Journey", value: artist.journey },
                { label: "Influences", value: artist.influences },
                { label: "Thanks", value: artist.acknowledgments },
                { label: "Goals & Ambitions", value: artist.goals },
              ].filter((section) => section.value).map((section) => (
                <div key={section.label} style={{ marginBottom: "28px" }}>
                  <h3 style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "10px" }}>
                    {section.label}
                  </h3>
                  <p style={{ fontSize: "14px", lineHeight: 1.8, color: "var(--afa-ink)", opacity: 0.75, whiteSpace: "pre-wrap" }}>
                    {section.value}
                  </p>
                </div>
              ))}

              {/* FEAT-2608-047 (11 Aug) - self-managed tour list, purely
                  informational (not tied to AFA's booking flow - these
                  shows aren't happening through the platform). Sorted by
                  date server-side; undated stops sort last. */}
              {artist.tourStops && artist.tourStops.length > 0 && (
                <div style={{ marginBottom: "28px" }}>
                  <h3 style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "12px" }}>
                    Tour
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {artist.tourStops.map((stop) => (
                      <div key={stop.id} style={{ display: "flex", alignItems: "center", gap: "12px", background: "white", borderRadius: "10px", padding: "12px 16px", border: "1px solid rgba(14,12,10,0.08)" }}>
                        <span style={{ fontSize: "18px" }}>📍</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--afa-ink)" }}>{stop.city}, {stop.country}</div>
                          {stop.date && (
                            <div style={{ fontSize: "12px", color: "var(--afa-ink)", opacity: 0.55 }}>
                              {new Date(stop.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </div>
                          )}
                        </div>
                        {stop.link && (
                          <a href={stop.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "var(--afa-terracotta)", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
                            Details →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {artist.videoReel.length > 0 && (
                <>
                  <h3 style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "12px" }}>Reels</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {artist.videoReel.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "var(--afa-terracotta)", wordBreak: "break-all" }}>{url}</a>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "shows" && (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "20px" }}>Upcoming Shows</h2>
              {upcomingShows.length === 0 ? (
                <p style={{ fontSize: "14px", color: "var(--afa-ink)", opacity: 0.5, marginBottom: "32px" }}>No upcoming shows booked yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
                  {upcomingShows.map((p) => (
                    <div key={p.id} style={{ background: "white", borderRadius: "12px", padding: "20px", border: "1px solid rgba(14,12,10,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                      <div>
                        <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "6px" }}>{p.event.title}</div>
                        <div style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.55 }}>📍 {p.event.venue ? `${p.event.venue.name} · ${p.event.venue.city}` : "Venue TBD"}</div>
                        <div style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.55 }}>📅 {new Date(p.event.date).toLocaleDateString()}</div>
                      </div>
                      <Link href={`/events/${p.event.id}`} style={{ background: "var(--afa-ink)", color: "white", padding: "10px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>View Event</Link>
                    </div>
                  ))}
                </div>
              )}

              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "20px" }}>Past Shows</h2>
              {pastShows.length === 0 ? (
                <p style={{ fontSize: "14px", color: "var(--afa-ink)", opacity: 0.5 }}>No past shows yet.</p>
              ) : (
                <div style={{ position: "relative", paddingLeft: "24px" }}>
                  <div style={{ position: "absolute", left: "8px", top: 0, bottom: 0, width: "2px", background: "rgba(14,12,10,0.1)" }} />
                  {pastShows.map((p, i) => (
                    <div key={p.id} style={{ position: "relative", marginBottom: "20px" }}>
                      <div style={{ position: "absolute", left: "-20px", top: "4px", width: "10px", height: "10px", borderRadius: "50%", background: i === 0 ? "var(--afa-terracotta)" : "rgba(14,12,10,0.2)" }} />
                      <div style={{ background: "white", borderRadius: "10px", padding: "14px 16px", border: "1px solid rgba(14,12,10,0.08)" }}>
                        <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--afa-ink)", marginBottom: "4px" }}>{p.event.title}</div>
                        <div style={{ fontSize: "12px", color: "var(--afa-ink)", opacity: 0.5 }}>{p.event.venue ? `${p.event.venue.name} · ${p.event.venue.city}` : "Venue TBD"} · {new Date(p.event.date).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {socialEntries.length > 0 && (
            <div style={{ background: "white", borderRadius: "12px", padding: "20px", border: "1px solid rgba(14,12,10,0.08)" }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: "16px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "16px" }}>Connect</div>
              {socialEntries.map(([platform, handle]) => (
                <a key={platform} href={handle} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", textDecoration: "none" }}>
                  <span style={{ fontSize: "18px" }}>{SOCIAL_ICON[platform] || "🔗"}</span>
                  <span style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.7, wordBreak: "break-all" }}>{handle}</span>
                </a>
              ))}
            </div>
          )}

          <div style={{ background: "var(--afa-ink)", borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "16px", fontWeight: 700, color: "white", marginBottom: "8px" }}>🎤 Book for your event</div>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: "16px" }}>Are you an organiser? Log in to invite {displayName} to apply for your event.</p>
            <Link href="/login" style={{ display: "block", background: "var(--afa-terracotta)", color: "white", padding: "12px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, textAlign: "center", textDecoration: "none" }}>
              Log In
            </Link>
          </div>
        </div>
      </div>

      <AuthPromptSheet
        open={showAuthSheet}
        onClose={() => setShowAuthSheet(false)}
        title={`Sign in to follow ${displayName}`}
        subtitle="Get notified when they book a new show"
        onSuccess={() => {
          setShowAuthSheet(false)
          toggleFollow()
        }}
      />
    </main>
  )
}
