"use client"
import { useState, useEffect, type TouchEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import SiteNav from "@/components/SiteNav"
import AuthPromptSheet from "@/components/AuthPromptSheet"
import CorporateInquiryModal from "@/components/CorporateInquiryModal"
import Photo from "@/components/Photo"
import ArtistNoPhoto from "@/components/ArtistNoPhoto"
import { isPlaceholderImageUrl } from "@/lib/placeholder-image"
import { CheckSealIcon, RepeatIcon } from "@/components/icons/ArtistIcons"
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

const TAB_LABEL: Record<"about" | "shows", string> = {
  about: "About",
  // Trimmed to Past Shows only (GEN-2608-073) - upcoming shows now get
  // real visual priority in the dedicated section between the hero and
  // this tab grid, so showing them twice would be redundant.
  shows: "History",
}

export default function ArtistProfilePage({
  artist,
  isVerified,
  sceneStatus,
  realTourStops,
}: {
  artist: ArtistData | null
  isVerified?: boolean
  sceneStatus?: SceneStatusTier | null
  realTourStops?: { id: string; title: string; date: string; startTime: string; venue: { name: string; city: string } | null; tour: { title: string; slug: string } | null }[]
}) {
  const [activeTab, setActiveTab] = useState<"about" | "shows">("about")
  const { data: session, status: sessionStatus } = useSession()
  const [following, setFollowing] = useState(false)
  const [notifyEnabled, setNotifyEnabledState] = useState(true)
  const [followerCount, setFollowerCount] = useState(artist?._count.followers ?? 0)
  const [followBusy, setFollowBusy] = useState(false)
  const [showAuthSheet, setShowAuthSheet] = useState(false)
  // FEAT-2608-046 (11 Aug, Hitesh's rule): booking inquiries now require
  // login, same as Follow - one shared AuthPromptSheet gates both, so
  // this tracks which action to resume once sign-in succeeds.
  const [authAction, setAuthAction] = useState<"follow" | "corporate" | null>(null)
  const [showCorporateModal, setShowCorporateModal] = useState(false)
  const router = useRouter()

  // "Book for your event" card, real invite version (11 Aug, Hitesh:
  // "keep it invite for published event"). Only fetched for a logged-in
  // Organiser - reuses the existing /api/events/my-events endpoint
  // (already Organiser-only) rather than a new one just for this list.
  const userRole = (session?.user as any)?.role as string | undefined
  const [organiserEvents, setOrganiserEvents] = useState<any[]>([])
  const [selectedInviteEventId, setSelectedInviteEventId] = useState("")
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    if (userRole !== "ORGANISER") return
    fetch("/api/events/my-events")
      .then((res) => (res.ok ? res.json() : []))
      .then((events) => setOrganiserEvents(Array.isArray(events) ? events : []))
      .catch(() => {})
  }, [userRole])

  const isPastInviteEvent = (e: { date: string; startTime: string }) => {
    const [h, m] = e.startTime.split(":").map(Number)
    const start = new Date(e.date)
    start.setHours(h, m, 0, 0)
    return start.getTime() <= Date.now()
  }

  // Published, still upcoming, and this artist isn't already
  // applied/booked on it - same duplicate guard the API enforces,
  // filtered here too so it's never offered as a selectable option in
  // the first place.
  const invitableEvents = artist
    ? organiserEvents.filter(
        (e) => e.status === "APPROVED" && !isPastInviteEvent(e) && !(e.applications || []).some((a: any) => a.artistId === artist.id)
      )
    : []

  const sendInvite = async () => {
    if (!artist || !selectedInviteEventId) return
    setInviting(true)
    setInviteResult(null)
    try {
      const res = await fetch(`/api/events/${selectedInviteEventId}/invite-artist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId: artist.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to send invite")
      setInviteResult({ ok: true, message: `${displayName} added to your lineup!` })
      // Bug caught live (11 Aug): local organiserEvents state was never
      // updated after a successful invite, so the just-invited event
      // stayed selectable in the dropdown until a full page reload -
      // picking it again correctly hit the server's duplicate guard
      // ("already applied") instead of the event simply disappearing
      // from the list the way it should the moment it's no longer
      // eligible. Patch the local application list for this event so
      // invitableEvents excludes it immediately, no refetch needed.
      setOrganiserEvents((prev) =>
        prev.map((e) =>
          e.id === selectedInviteEventId
            ? { ...e, applications: [...(e.applications || []), { artistId: artist.id }] }
            : e
        )
      )
      setSelectedInviteEventId("")
    } catch (err: any) {
      setInviteResult({ ok: false, message: err.message || "Something went wrong" })
    } finally {
      setInviting(false)
    }
  }

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
      setAuthAction("follow")
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

  // FEAT-2608-046 (11 Aug, Hitesh's rule): booking inquiries now require
  // login, same gate as Follow above.
  const openCorporateInquiry = () => {
    if (sessionStatus !== "authenticated") {
      setAuthAction("corporate")
      setShowAuthSheet(true)
      return
    }
    setShowCorporateModal(true)
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
      <main style={{ minHeight: "100vh", background: "var(--afa-surface-page)", fontFamily: "var(--font-sans)" }}>
        <SiteNav backHref="/artists" backLabel="← Back to Artists" />
        <div style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px", color: "var(--afa-text-primary)" }}>Artist not found.</div>
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
  const portraitUrl = artist.user.avatar && !isPlaceholderImageUrl(artist.user.avatar) ? artist.user.avatar : null

  return (
    <main
      style={{ minHeight: "100vh", background: "var(--afa-surface-page)", fontFamily: "var(--font-sans)" }}
      onTouchStart={handleProfileTouchStart}
      onTouchEnd={handleProfileTouchEnd}
    >
      <style>{`
        .afa-cta-solid { transition: filter 0.15s ease; }
        .afa-cta-solid:hover { filter: brightness(1.1); }
        .artist-hero-grid { grid-template-columns: 0.9fr 1.1fr; }
        .artist-vouched-grid { grid-template-columns: 0.85fr 1.15fr; }
        .artist-detail-grid { grid-template-columns: 1fr 320px; }
        @media (max-width: 900px) {
          .artist-hero-grid { grid-template-columns: 1fr !important; }
          .artist-vouched-grid { grid-template-columns: 1fr !important; }
          .artist-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <SiteNav backHref="/artists" backLabel="← Back to Artists" />

      {navOrder && navIndex >= 0 && (
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "10px 24px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: "16px" }}>
          <button
            onClick={goToPrevArtist}
            disabled={!prevArtistId}
            aria-label="Previous artist"
            className={prevArtistId ? "afa-cta-solid" : undefined}
            style={{
              background: prevArtistId ? "var(--afa-fill-solid)" : "var(--afa-surface-raised)",
              border: prevArtistId ? "none" : "1px solid rgba(245,245,240,0.13)",
              borderRadius: "999px",
              width: "34px",
              height: "34px",
              fontSize: "16px",
              fontWeight: 700,
              cursor: prevArtistId ? "pointer" : "default",
              opacity: prevArtistId ? 1 : 0.35,
              color: prevArtistId ? "var(--afa-on-fill-solid)" : "var(--afa-text-primary)",
            }}
          >
            ‹
          </button>
          <span style={{ fontSize: "12px", color: "rgba(245,245,240,0.5)" }}>
            Artist {navIndex + 1} of {navOrder.length}
          </span>
          <button
            onClick={goToNextArtist}
            disabled={!nextArtistId}
            aria-label="Next artist"
            className={nextArtistId ? "afa-cta-solid" : undefined}
            style={{
              background: nextArtistId ? "var(--afa-fill-solid)" : "var(--afa-surface-raised)",
              border: nextArtistId ? "none" : "1px solid rgba(245,245,240,0.13)",
              borderRadius: "999px",
              width: "34px",
              height: "34px",
              fontSize: "16px",
              fontWeight: 700,
              cursor: nextArtistId ? "pointer" : "default",
              opacity: nextArtistId ? 1 : 0.35,
              color: nextArtistId ? "var(--afa-on-fill-solid)" : "var(--afa-text-primary)",
            }}
          >
            ›
          </button>
        </div>
      )}

      {/* HERO - split layout: real photo (Photo.tsx duotone) or the
          genre-relevant no-photo fallback on the left, identity + actions
          on the right. Replaces the old small circular avatar treatment. */}
      <div style={{ padding: "40px 48px 0" }}>
        <div className="artist-hero-grid" style={{ maxWidth: "1100px", margin: "0 auto", display: "grid", gap: "40px" }}>
          <div style={{ position: "relative", aspectRatio: "4 / 5", minHeight: "320px", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(245,245,240,0.1)" }}>
            {portraitUrl ? (
              <Photo src={portraitUrl} alt={displayName} />
            ) : (
              <ArtistNoPhoto name={displayName} genres={artist.genre} size="hero" />
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: "32px" }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              {artist.genre.map((g) => (
                <span key={g} style={{ background: "rgba(201,151,58,0.15)", color: "var(--afa-amber)", fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: "4px" }}>{g.toUpperCase()}</span>
              ))}
            </div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 900, color: "var(--afa-cream)", lineHeight: 1.05, marginBottom: "12px", letterSpacing: "-1px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
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
                        ? "var(--afa-fill-solid)"
                        : sceneStatus === "FEATURED"
                        ? "rgba(201,151,58,0.2)"
                        : "rgba(245,245,240,0.12)",
                    color: sceneStatus === "HEADLINER" ? "var(--afa-on-fill-solid)" : sceneStatus === "FEATURED" ? "var(--afa-amber)" : "rgba(245,245,240,0.85)",
                    border: sceneStatus === "FEATURED" ? "1px solid var(--afa-amber)" : "none",
                  }}
                >
                  {sceneStatus === "HEADLINER" ? "★ Headliner" : sceneStatus === "FEATURED" ? "Featured" : "Rising"}
                </span>
              )}
            </h1>
            {artist.tagline && (
              <p style={{ fontSize: "16px", color: "rgba(245,245,240,0.75)", fontStyle: "italic", marginBottom: "16px", maxWidth: "500px" }}>
                &quot;{artist.tagline}&quot;
              </p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
              <button
                onClick={toggleFollow}
                disabled={followBusy}
                className={!following ? "afa-cta-solid" : undefined}
                style={{
                  fontSize: "13px", fontWeight: 700, padding: "8px 20px", borderRadius: "6px", cursor: "pointer",
                  border: following ? "1.5px solid rgba(245,245,240,0.4)" : "none",
                  background: following ? "transparent" : "var(--afa-fill-solid)",
                  color: following ? "var(--afa-cream)" : "var(--afa-on-fill-solid)",
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
                    border: "1.5px solid rgba(245,245,240,0.4)",
                    background: notifyEnabled ? "rgba(255,90,54,0.3)" : "transparent",
                    fontSize: "15px", cursor: followBusy ? "default" : "pointer",
                    opacity: followBusy ? 0.6 : 1,
                  }}
                >
                  {notifyEnabled ? "🔔" : "🔕"}
                </button>
              )}
              <span style={{ fontSize: "13px", color: "rgba(245,245,240,0.55)" }}>
                {followerCount} {followerCount === 1 ? "follower" : "followers"}
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {artist.styleTag.map((tag) => (
                <span key={tag} style={{ background: "rgba(245,245,240,0.08)", color: "var(--afa-text-primary)", fontSize: "12px", padding: "4px 12px", borderRadius: "99px", border: "1px solid rgba(245,245,240,0.15)" }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* VOUCHED FOR BY + UPCOMING SHOWS - given real visual priority per
          the approved spec, replacing the old 4-stat bar (Followers moved
          into the hero above; Total Shows/Upcoming count redistributed as
          footer/header labels below). */}
      <div className="artist-vouched-grid" style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 48px 0", display: "grid", gap: "40px" }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(245,245,240,0.55)", marginBottom: "16px" }}>
            Vouched for by
          </h2>
          <div style={{ border: "1px solid rgba(201,151,58,0.25)", borderRadius: "12px", background: "var(--afa-surface-page)", overflow: "hidden" }}>
            <div style={{ display: "flex", gap: "16px", padding: "20px", borderBottom: "1px solid rgba(245,245,240,0.1)" }}>
              <CheckSealIcon style={{ width: "28px", height: "28px", color: "var(--afa-amber)", flexShrink: 0, marginTop: "2px" }} />
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "32px", color: "var(--afa-cream)" }}>{artist.verifiedAttendees}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(245,245,240,0.55)" }}>verified attendees</span>
                </div>
                <p style={{ marginTop: "6px", fontSize: "13px", lineHeight: 1.6, color: "rgba(245,245,240,0.6)" }}>
                  Audience accounts who checked in at a show {displayName.split(" ")[0]} performed at.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "16px", padding: "20px" }}>
              <RepeatIcon style={{ width: "28px", height: "28px", color: "var(--afa-amber)", flexShrink: 0, marginTop: "2px" }} />
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "32px", color: "var(--afa-cream)" }}>{artist.repeatAttendees}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(245,245,240,0.55)" }}>came back for more</span>
                </div>
                <p style={{ marginTop: "6px", fontSize: "13px", lineHeight: 1.6, color: "rgba(245,245,240,0.6)" }}>
                  Repeat attendees who&rsquo;ve booked {displayName.split(" ")[0]} more than once.
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(245,245,240,0.1)", marginTop: "12px", paddingTop: "12px" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(245,245,240,0.5)" }}>Total performances</span>
            <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "20px", color: "var(--afa-cream)" }}>{artist._count.performances}</span>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "16px" }}>
            <h2 style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(245,245,240,0.55)" }}>Upcoming shows</h2>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(245,245,240,0.4)" }}>{upcomingShows.length} {upcomingShows.length === 1 ? "date" : "dates"}</span>
          </div>
          {upcomingShows.length === 0 ? (
            <p style={{ fontSize: "14px", color: "rgba(245,245,240,0.5)" }}>No upcoming shows booked yet.</p>
          ) : (
            <div>
              {upcomingShows.map((p) => {
                const eventDate = new Date(p.event.date)
                return (
                  <div key={p.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: "16px", padding: "16px 0", borderTop: "1px solid rgba(245,245,240,0.1)" }}>
                    <div style={{ textAlign: "center", width: "48px" }}>
                      <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "26px", lineHeight: 1, color: "var(--afa-cream)" }}>{eventDate.getDate()}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--afa-amber)" }}>{eventDate.toLocaleDateString("en-IN", { month: "short" })}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "18px", color: "var(--afa-cream)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.event.title}</div>
                      <div style={{ fontSize: "13px", color: "rgba(245,245,240,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.event.venue ? `${p.event.venue.name} · ${p.event.venue.city}` : "Venue TBD"}</div>
                    </div>
                    <Link href={`/events/${p.event.id}`} className="afa-cta-solid" style={{ background: "var(--afa-fill-solid)", color: "var(--afa-on-fill-solid)", padding: "8px 18px", borderRadius: "6px", fontSize: "12px", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
                      Book
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="artist-detail-grid" style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 48px 32px", display: "grid", gap: "32px" }}>
        {/* LEFT */}
        <div>
          <div style={{ display: "flex", gap: "0", marginBottom: "32px", borderBottom: "2px solid rgba(245,245,240,0.1)" }}>
            {(["about", "shows"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{ padding: "12px 24px", border: "none", background: "transparent", fontSize: "14px", fontWeight: 600, color: activeTab === tab ? "var(--afa-amber)" : "var(--afa-text-primary)", cursor: "pointer", borderBottom: `2px solid ${activeTab === tab ? "var(--afa-amber)" : "transparent"}`, marginBottom: "-2px" }}
              >
                {TAB_LABEL[tab]}
              </button>
            ))}
          </div>

          {activeTab === "about" && (
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "12px" }}>About</h2>
              <p style={{ fontSize: "15px", lineHeight: 1.8, color: "var(--afa-text-primary)", opacity: artist.bio ? 0.75 : 0.4, marginBottom: "32px", fontStyle: artist.bio ? "normal" : "italic" }}>
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
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "10px" }}>
                    {section.label}
                  </h3>
                  <p style={{ fontSize: "14px", lineHeight: 1.8, color: "var(--afa-text-primary)", opacity: 0.75, whiteSpace: "pre-wrap" }}>
                    {section.value}
                  </p>
                </div>
              ))}

              {/* Tour by Organiser (12 Aug) - real, bookable Tour stops,
                  visually distinct ("Book on AFA") from the self-reported
                  informational list below it, so an audience member never
                  taps expecting to book and finds out it's just a note. */}
              {realTourStops && realTourStops.length > 0 && (
                <div style={{ marginBottom: "28px" }}>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "12px" }}>
                    Tour
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {realTourStops.map((stop) => (
                      <Link
                        key={stop.id}
                        href={`/events/${stop.id}`}
                        style={{ display: "flex", alignItems: "center", gap: "12px", background: "var(--afa-surface-raised)", borderRadius: "10px", padding: "12px 16px", border: "1px solid var(--afa-sage)", textDecoration: "none" }}
                      >
                        <span style={{ fontSize: "18px" }}>🎟️</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--afa-text-primary)" }}>
                            {stop.title}{stop.venue && ` — ${stop.venue.city}`}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--afa-text-primary)", opacity: 0.55 }}>
                            {new Date(stop.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            {stop.tour && ` · Part of ${stop.tour.title}`}
                          </div>
                        </div>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--afa-sage)", whiteSpace: "nowrap" }}>Book on AFA →</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* FEAT-2608-047 (11 Aug) - self-managed tour list, purely
                  informational (not tied to AFA's booking flow - these
                  shows aren't happening through the platform). Sorted by
                  date server-side; undated stops sort last. */}
              {artist.tourStops && artist.tourStops.length > 0 && (
                <div style={{ marginBottom: "28px" }}>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "12px" }}>
                    Tour
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {artist.tourStops.map((stop) => (
                      <div key={stop.id} style={{ display: "flex", alignItems: "center", gap: "12px", background: "var(--afa-surface-raised)", borderRadius: "10px", padding: "12px 16px", border: "1px solid rgba(245,245,240,0.1)" }}>
                        <span style={{ fontSize: "18px" }}>📍</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--afa-text-primary)" }}>{stop.city}, {stop.country}</div>
                          {stop.date && (
                            <div style={{ fontSize: "12px", color: "var(--afa-text-primary)", opacity: 0.55 }}>
                              {new Date(stop.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </div>
                          )}
                        </div>
                        {stop.link && (
                          <a href={stop.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "var(--afa-fill-solid)", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
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
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "12px" }}>Reels</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {artist.videoReel.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "var(--afa-fill-solid)", wordBreak: "break-all" }}>{url}</a>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "shows" && (
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "20px" }}>Past Shows</h2>
              {pastShows.length === 0 ? (
                <p style={{ fontSize: "14px", color: "var(--afa-text-primary)", opacity: 0.5 }}>No past shows yet.</p>
              ) : (
                <div style={{ position: "relative", paddingLeft: "24px" }}>
                  <div style={{ position: "absolute", left: "8px", top: 0, bottom: 0, width: "2px", background: "rgba(245,245,240,0.1)" }} />
                  {pastShows.map((p, i) => (
                    <div key={p.id} style={{ position: "relative", marginBottom: "20px" }}>
                      <div style={{ position: "absolute", left: "-20px", top: "4px", width: "10px", height: "10px", borderRadius: "50%", background: i === 0 ? "var(--afa-amber)" : "rgba(245,245,240,0.2)" }} />
                      <div style={{ background: "var(--afa-surface-raised)", borderRadius: "10px", padding: "14px 16px", border: "1px solid rgba(245,245,240,0.1)" }}>
                        <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--afa-text-primary)", marginBottom: "4px" }}>{p.event.title}</div>
                        <div style={{ fontSize: "12px", color: "var(--afa-text-primary)", opacity: 0.5 }}>{p.event.venue ? `${p.event.venue.name} · ${p.event.venue.city}` : "Venue TBD"} · {new Date(p.event.date).toLocaleDateString()}</div>
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
            <div style={{ background: "var(--afa-surface-raised)", borderRadius: "12px", padding: "20px", border: "1px solid rgba(245,245,240,0.1)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "16px" }}>Connect</div>
              {socialEntries.map(([platform, handle]) => (
                <a key={platform} href={handle} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", textDecoration: "none" }}>
                  <span style={{ fontSize: "18px" }}>{SOCIAL_ICON[platform] || "🔗"}</span>
                  <span style={{ fontSize: "13px", color: "var(--afa-text-primary)", opacity: 0.7, wordBreak: "break-all" }}>{handle}</span>
                </a>
              ))}
            </div>
          )}

          <div style={{ background: "var(--afa-surface-inverse)", borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700, color: "var(--afa-cream)", marginBottom: "8px" }}>🎤 Book for your event</div>

            {sessionStatus === "authenticated" && userRole === "ORGANISER" ? (
              <>
                <p style={{ fontSize: "13px", color: "rgba(245,245,240,0.55)", lineHeight: 1.6, marginBottom: "14px" }}>
                  Invite {displayName} directly into one of your published events.
                </p>
                {invitableEvents.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "rgba(245,245,240,0.4)", lineHeight: 1.5 }}>
                    No eligible published events right now - {displayName} may already be in the lineup for all of yours, or none are published yet.
                  </p>
                ) : (
                  <>
                    <select
                      value={selectedInviteEventId}
                      onChange={(e) => { setSelectedInviteEventId(e.target.value); setInviteResult(null) }}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid rgba(245,245,240,0.2)", background: "rgba(245,245,240,0.08)", color: "var(--afa-cream)", fontSize: "13px", marginBottom: "10px" }}
                    >
                      <option value="" style={{ color: "black" }}>Select an event...</option>
                      {invitableEvents.map((e) => (
                        <option key={e.id} value={e.id} style={{ color: "black" }}>
                          {e.title} · {new Date(e.date).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={sendInvite}
                      disabled={!selectedInviteEventId || inviting}
                      className="afa-cta-solid"
                      style={{ display: "block", width: "100%", background: "var(--afa-fill-solid)", color: "var(--afa-on-fill-solid)", padding: "12px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, textAlign: "center", border: "none", cursor: !selectedInviteEventId || inviting ? "default" : "pointer", opacity: !selectedInviteEventId || inviting ? 0.6 : 1 }}
                    >
                      {inviting ? "Sending..." : "Invite to Lineup"}
                    </button>
                  </>
                )}
                {inviteResult && (
                  <p style={{ fontSize: "12px", marginTop: "10px", color: inviteResult.ok ? "var(--afa-sage)" : "var(--afa-fill-solid)" }}>
                    {inviteResult.message}
                  </p>
                )}
              </>
            ) : sessionStatus === "authenticated" ? (
              <p style={{ fontSize: "13px", color: "rgba(245,245,240,0.55)", lineHeight: 1.6 }}>
                Organisers can invite {displayName} directly into their published events.
              </p>
            ) : (
              <>
                <p style={{ fontSize: "13px", color: "rgba(245,245,240,0.55)", lineHeight: 1.6, marginBottom: "16px" }}>Are you an organiser? Log in to invite {displayName} directly into your event's lineup.</p>
                <Link href="/login" className="afa-cta-solid" style={{ display: "block", background: "var(--afa-fill-solid)", color: "var(--afa-on-fill-solid)", padding: "12px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, textAlign: "center", textDecoration: "none" }}>
                  Log In
                </Link>
              </>
            )}
          </div>

          {/* FEAT-2608-046 - corporate/private booking, inquiry-only.
              Login required as of 11 Aug (Hitesh's rule) - same gate as
              Follow. */}
          <div style={{ background: "var(--afa-surface-raised)", borderRadius: "12px", padding: "20px", border: "1px solid rgba(245,245,240,0.1)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "8px" }}>🏢 Corporate or Private Event?</div>
            <p style={{ fontSize: "13px", color: "var(--afa-text-primary)", opacity: 0.6, lineHeight: 1.6, marginBottom: "16px" }}>Send {displayName} a direct booking inquiry.</p>
            <button
              onClick={openCorporateInquiry}
              style={{ display: "block", width: "100%", background: "transparent", color: "var(--afa-text-primary)", border: "1.5px solid rgba(245,245,240,0.2)", padding: "12px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer" }}
            >
              Send Inquiry
            </button>
          </div>
        </div>
      </div>

      <CorporateInquiryModal
        open={showCorporateModal}
        onClose={() => setShowCorporateModal(false)}
        artistId={artist.id}
        artistName={displayName}
        prefillName={session?.user ? ((session.user as any).displayName || session.user.name || "") : ""}
        prefillEmail={session?.user?.email || ""}
      />

      <AuthPromptSheet
        open={showAuthSheet}
        onClose={() => setShowAuthSheet(false)}
        title={authAction === "corporate" ? `Sign in to book ${displayName}` : `Sign in to follow ${displayName}`}
        subtitle={authAction === "corporate" ? "Booking inquiries now require an AforAudience account" : "Get notified when they book a new show"}
        onSuccess={() => {
          setShowAuthSheet(false)
          if (authAction === "corporate") {
            setShowCorporateModal(true)
          } else {
            toggleFollow()
          }
        }}
      />
    </main>
  )
}
