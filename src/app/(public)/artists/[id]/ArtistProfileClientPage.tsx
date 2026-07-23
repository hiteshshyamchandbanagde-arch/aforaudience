"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import SiteNav from "@/components/SiteNav"
import AuthPromptSheet from "@/components/AuthPromptSheet"

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
  hypScore: number
  socialLinks: Record<string, string> | null
  videoReel: string[]
  user: { name: string; avatar: string | null }
  performances: Performance[]
  _count: { performances: number; followers: number }
}

const SOCIAL_ICON: Record<string, string> = {
  instagram: "📸",
  youtube: "▶️",
  twitter: "🐦",
}

export default function ArtistProfilePage({ artist }: { artist: ArtistData | null }) {
  const [activeTab, setActiveTab] = useState<"about" | "shows">("about")
  const { status: sessionStatus } = useSession()
  const [following, setFollowing] = useState(false)
  const [notifyEnabled, setNotifyEnabledState] = useState(true)
  const [followerCount, setFollowerCount] = useState(artist?._count.followers ?? 0)
  const [followBusy, setFollowBusy] = useState(false)
  const [showAuthSheet, setShowAuthSheet] = useState(false)

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
      <main style={{ minHeight: "100vh", background: "#F7F3EE", fontFamily: "system-ui, sans-serif" }}>
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

  return (
    <main style={{ minHeight: "100vh", background: "#F7F3EE", fontFamily: "system-ui, sans-serif" }}>
      <SiteNav backHref="/artists" backLabel="← Back to Artists" />

      {/* HERO */}
      <div style={{ background: "#1a0a1a", padding: "64px 48px 40px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", gap: "32px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ width: "140px", height: "140px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "4px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "56px", fontWeight: 700, color: "white" }}>
            {artist.user.name.charAt(0).toUpperCase()}
          </div>

          <div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
              {artist.genre.map((g) => (
                <span key={g} style={{ background: "#C8441A", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: "4px" }}>{g.toUpperCase()}</span>
              ))}
              <span style={{ background: "rgba(201,151,58,0.9)", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: "4px" }}>🔥 Hype {artist.hypScore.toFixed(1)}</span>
            </div>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 900, color: "white", lineHeight: 1.05, marginBottom: "12px", letterSpacing: "-1px" }}>
              {artist.user.name}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <button
                onClick={toggleFollow}
                disabled={followBusy}
                style={{
                  fontSize: "13px", fontWeight: 700, padding: "8px 20px", borderRadius: "6px", cursor: "pointer",
                  border: following ? "1.5px solid rgba(255,255,255,0.4)" : "none",
                  background: following ? "transparent" : "#C8441A",
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
            { num: `🔥 ${artist.hypScore.toFixed(1)}`, label: "Hype Score" },
            { num: followerCount, label: "Followers" },
            { num: artist._count.performances, label: "Total Shows" },
            { num: upcomingShows.length, label: "Upcoming" },
          ].map((stat) => (
            <div key={stat.label}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "#0E0C0A", lineHeight: 1 }}>{stat.num}</div>
              <div style={{ fontSize: "12px", color: "#0E0C0A", opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "4px" }}>{stat.label}</div>
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
                style={{ padding: "12px 24px", border: "none", background: "transparent", fontSize: "14px", fontWeight: 600, color: activeTab === tab ? "#C8441A" : "#0E0C0A", cursor: "pointer", borderBottom: `2px solid ${activeTab === tab ? "#C8441A" : "transparent"}`, marginBottom: "-2px", textTransform: "capitalize" }}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "about" && (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#0E0C0A", marginBottom: "12px" }}>About</h2>
              <p style={{ fontSize: "15px", lineHeight: 1.8, color: "#0E0C0A", opacity: artist.bio ? 0.75 : 0.4, marginBottom: "32px", fontStyle: artist.bio ? "normal" : "italic" }}>
                {artist.bio || "This artist hasn't added a bio yet."}
              </p>

              {artist.videoReel.length > 0 && (
                <>
                  <h3 style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "#0E0C0A", marginBottom: "12px" }}>Reels</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {artist.videoReel.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "#C8441A", wordBreak: "break-all" }}>{url}</a>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "shows" && (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#0E0C0A", marginBottom: "20px" }}>Upcoming Shows</h2>
              {upcomingShows.length === 0 ? (
                <p style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.5, marginBottom: "32px" }}>No upcoming shows booked yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
                  {upcomingShows.map((p) => (
                    <div key={p.id} style={{ background: "white", borderRadius: "12px", padding: "20px", border: "1px solid rgba(14,12,10,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                      <div>
                        <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "#0E0C0A", marginBottom: "6px" }}>{p.event.title}</div>
                        <div style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.55 }}>📍 {p.event.venue ? `${p.event.venue.name} · ${p.event.venue.city}` : "Venue TBD"}</div>
                        <div style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.55 }}>📅 {new Date(p.event.date).toLocaleDateString()}</div>
                      </div>
                      <Link href={`/events/${p.event.id}`} style={{ background: "#0E0C0A", color: "white", padding: "10px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>View Event</Link>
                    </div>
                  ))}
                </div>
              )}

              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#0E0C0A", marginBottom: "20px" }}>Past Shows</h2>
              {pastShows.length === 0 ? (
                <p style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.5 }}>No past shows yet.</p>
              ) : (
                <div style={{ position: "relative", paddingLeft: "24px" }}>
                  <div style={{ position: "absolute", left: "8px", top: 0, bottom: 0, width: "2px", background: "rgba(14,12,10,0.1)" }} />
                  {pastShows.map((p, i) => (
                    <div key={p.id} style={{ position: "relative", marginBottom: "20px" }}>
                      <div style={{ position: "absolute", left: "-20px", top: "4px", width: "10px", height: "10px", borderRadius: "50%", background: i === 0 ? "#C8441A" : "rgba(14,12,10,0.2)" }} />
                      <div style={{ background: "white", borderRadius: "10px", padding: "14px 16px", border: "1px solid rgba(14,12,10,0.08)" }}>
                        <div style={{ fontWeight: 600, fontSize: "14px", color: "#0E0C0A", marginBottom: "4px" }}>{p.event.title}</div>
                        <div style={{ fontSize: "12px", color: "#0E0C0A", opacity: 0.5 }}>{p.event.venue ? `${p.event.venue.name} · ${p.event.venue.city}` : "Venue TBD"} · {new Date(p.event.date).toLocaleDateString()}</div>
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
              <div style={{ fontFamily: "Georgia, serif", fontSize: "16px", fontWeight: 700, color: "#0E0C0A", marginBottom: "16px" }}>Connect</div>
              {socialEntries.map(([platform, handle]) => (
                <a key={platform} href={handle} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", textDecoration: "none" }}>
                  <span style={{ fontSize: "18px" }}>{SOCIAL_ICON[platform] || "🔗"}</span>
                  <span style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.7, wordBreak: "break-all" }}>{handle}</span>
                </a>
              ))}
            </div>
          )}

          <div style={{ background: "#0E0C0A", borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "16px", fontWeight: 700, color: "white", marginBottom: "8px" }}>🎤 Book for your event</div>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: "16px" }}>Are you an organiser? Log in to invite {artist.user.name} to apply for your event.</p>
            <Link href="/login" style={{ display: "block", background: "#C8441A", color: "white", padding: "12px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, textAlign: "center", textDecoration: "none" }}>
              Log In
            </Link>
          </div>
        </div>
      </div>

      <AuthPromptSheet
        open={showAuthSheet}
        onClose={() => setShowAuthSheet(false)}
        title={`Sign in to follow ${artist.user.name}`}
        subtitle="Get notified when they book a new show"
        onSuccess={() => {
          setShowAuthSheet(false)
          toggleFollow()
        }}
      />
    </main>
  )
}
