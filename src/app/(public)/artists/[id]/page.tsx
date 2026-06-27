"use client"
import { useState } from "react"
import Link from "next/link"

const ARTIST_DATA: Record<string, any> = {
  "1": {
    id: "1",
    name: "Rohit Shah",
    genre: "Stand Up Comedy",
    subGenre: "Dark Comedy · Observational · Political",
    city: "Mumbai",
    emoji: "😄",
    color: "#1a0500",
    bio: "Rohit Shah is one of Mumbai's most celebrated stand-up comedians with over 8 years on stage. Known for his razor-sharp wit and unapologetically dark humor, he has performed at every major comedy club in India and toured internationally. His debut special 'Uncomfortable Truths' garnered over 2 million views online.",
    hypScore: 94,
    rating: 4.8,
    totalShows: 320,
    followers: 12400,
    cities: 24,
    styleTag: ["Dark Humor", "Storytelling", "Political", "Self-deprecating"],
    socialLinks: {
      instagram: "@rohitshah_comedy",
      youtube: "RohitShahComedy",
      twitter: "@rohitshahcomedy"
    },
    upcomingShows: [
      { id: "1", title: "Midnight Laughs Vol. 12", venue: "The Comedy Store", city: "Mumbai", date: "Sat, 28 Jun", price: 399 },
      { id: "3", title: "Raw Stage Night", venue: "Humming Tree", city: "Bangalore", date: "Sun, 29 Jun", price: 199 },
    ],
    pastShows: [
      { title: "The Uncomfortable Truth Tour", venue: "NCPA", city: "Mumbai", date: "Mar 2025", attended: 450 },
      { title: "Comedy Festival 2025", venue: "Jio World", city: "Mumbai", date: "Feb 2025", attended: 1200 },
      { title: "Open Mic Champions", venue: "Canvas Laugh Club", city: "Mumbai", date: "Jan 2025", attended: 280 },
    ],
    reviews: [
      { name: "Sneha R.", rating: 5, comment: "Absolutely hilarious! His dark humor is so refreshing and real.", date: "Jun 15", show: "Midnight Laughs" },
      { name: "Amit K.", rating: 5, comment: "Best stand up I've seen in years. The political bits were genius.", date: "Jun 10", show: "Comedy Festival" },
      { name: "Priya M.", rating: 4, comment: "Very funny but some jokes were a bit too dark for my taste!", date: "Jun 5", show: "Open Mic" },
      { name: "Karan S.", rating: 5, comment: "Saw him live for the first time. Instantly became a fan!", date: "May 28", show: "Midnight Laughs" },
    ],
    awards: ["Best Newcomer 2019", "Comedy Central Feature 2022", "Top 10 Comedians India 2024"],
  }
}

export default function ArtistProfilePage({ params }: { params: { id: string } }) {
  const artist = ARTIST_DATA[params.id] || ARTIST_DATA["1"]
  const [activeTab, setActiveTab] = useState<"about"|"shows"|"reviews">("about")
  const [following, setFollowing] = useState(false)

  return (
    <main style={{ minHeight: "100vh", background: "#F7F3EE", fontFamily: "system-ui, sans-serif" }}>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 48px", background: "rgba(247,243,238,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(14,12,10,0.08)" }}>
        <Link href="/" style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: 700, color: "#0E0C0A", textDecoration: "none" }}>
          <span style={{ color: "#C8441A" }}>A</span>forAudience
        </Link>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <Link href="/events" style={{ fontSize: "14px", color: "#0E0C0A", textDecoration: "none", opacity: 0.6 }}>Events</Link>
          <Link href="/login" style={{ fontSize: "14px", fontWeight: 600, color: "#F7F3EE", textDecoration: "none", background: "#0E0C0A", padding: "8px 20px", borderRadius: "6px" }}>Sign In</Link>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ background: artist.color, padding: "64px 48px 0" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "32px", alignItems: "flex-end" }}>

          {/* Avatar */}
          <div style={{ width: "140px", height: "140px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "4px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "64px", marginBottom: "-20px" }}>
            {artist.emoji}
          </div>

          {/* Info */}
          <div style={{ paddingBottom: "24px" }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
              <span style={{ background: "#C8441A", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: "4px" }}>{artist.genre.toUpperCase()}</span>
              <span style={{ background: "rgba(255,255,255,0.15)", color: "white", fontSize: "11px", padding: "4px 12px", borderRadius: "4px" }}>📍 {artist.city}</span>
              <span style={{ background: "rgba(201,151,58,0.9)", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: "4px" }}>🔥 Hype Score: {artist.hypScore}</span>
            </div>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 900, color: "white", lineHeight: 1.05, marginBottom: "8px", letterSpacing: "-1px" }}>
              {artist.name}
            </h1>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", marginBottom: "16px" }}>{artist.subGenre}</p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {artist.styleTag.map((tag: string) => (
                <span key={tag} style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", fontSize: "12px", padding: "4px 12px", borderRadius: "99px", border: "1px solid rgba(255,255,255,0.15)" }}>{tag}</span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ paddingBottom: "24px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              onClick={() => setFollowing(!following)}
              style={{ background: following ? "rgba(255,255,255,0.1)" : "white", color: following ? "white" : "#0E0C0A", padding: "12px 28px", borderRadius: "8px", border: following ? "1px solid rgba(255,255,255,0.3)" : "none", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
            >
              {following ? "✓ Following" : "Follow Artist"}
            </button>
            <button style={{ background: "transparent", color: "rgba(255,255,255,0.6)", padding: "10px 28px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)", fontSize: "14px", cursor: "pointer" }}>
              💸 Send Tip
            </button>
          </div>
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{ background: "white", borderBottom: "1px solid rgba(14,12,10,0.08)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px 48px", display: "flex", gap: "48px", flexWrap: "wrap" }}>
          {[
            { num: `⭐ ${artist.rating}`, label: "Rating" },
            { num: artist.totalShows, label: "Shows" },
            { num: `${(artist.followers / 1000).toFixed(1)}k`, label: "Followers" },
            { num: artist.cities, label: "Cities" },
            { num: artist.reviews.length * 12, label: "Reviews" },
          ].map(stat => (
            <div key={stat.label}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "#0E0C0A", lineHeight: 1 }}>{stat.num}</div>
              <div style={{ fontSize: "12px", color: "#0E0C0A", opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "4px" }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 48px", display: "grid", gridTemplateColumns: "1fr 320px", gap: "32px" }}>

        {/* LEFT */}
        <div>
          {/* TABS */}
          <div style={{ display: "flex", gap: "0", marginBottom: "32px", borderBottom: "2px solid rgba(14,12,10,0.1)" }}>
            {(["about", "shows", "reviews"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "12px 24px", border: "none", background: "transparent", fontSize: "14px", fontWeight: 600, color: activeTab === tab ? "#C8441A" : "#0E0C0A", cursor: "pointer", borderBottom: `2px solid ${activeTab === tab ? "#C8441A" : "transparent"}`, marginBottom: "-2px", textTransform: "capitalize" }}>
                {tab}
              </button>
            ))}
          </div>

          {/* ABOUT */}
          {activeTab === "about" && (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#0E0C0A", marginBottom: "12px" }}>About</h2>
              <p style={{ fontSize: "15px", lineHeight: 1.8, color: "#0E0C0A", opacity: 0.75, marginBottom: "32px" }}>{artist.bio}</p>

              {/* Awards */}
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "#0E0C0A", marginBottom: "12px" }}>Awards & Recognition</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "32px" }}>
                {artist.awards.map((award: string) => (
                  <div key={award} style={{ background: "white", borderRadius: "8px", padding: "12px 16px", border: "1px solid rgba(14,12,10,0.08)", display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "20px" }}>🏆</span>
                    <span style={{ fontSize: "14px", color: "#0E0C0A", fontWeight: 500 }}>{award}</span>
                  </div>
                ))}
              </div>

              {/* Stage Journey */}
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "#0E0C0A", marginBottom: "12px" }}>Stage Journey</h3>
              <div style={{ position: "relative", paddingLeft: "24px" }}>
                <div style={{ position: "absolute", left: "8px", top: 0, bottom: 0, width: "2px", background: "rgba(14,12,10,0.1)" }} />
                {artist.pastShows.map((show: any, i: number) => (
                  <div key={show.title} style={{ position: "relative", marginBottom: "20px" }}>
                    <div style={{ position: "absolute", left: "-20px", top: "4px", width: "10px", height: "10px", borderRadius: "50%", background: i === 0 ? "#C8441A" : "rgba(14,12,10,0.2)" }} />
                    <div style={{ background: "white", borderRadius: "10px", padding: "14px 16px", border: "1px solid rgba(14,12,10,0.08)" }}>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "#0E0C0A", marginBottom: "4px" }}>{show.title}</div>
                      <div style={{ fontSize: "12px", color: "#0E0C0A", opacity: 0.5 }}>{show.venue} · {show.city} · {show.date}</div>
                      <div style={{ fontSize: "12px", color: "#C8441A", marginTop: "4px" }}>👥 {show.attended} attended</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SHOWS */}
          {activeTab === "shows" && (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#0E0C0A", marginBottom: "20px" }}>Upcoming Shows</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {artist.upcomingShows.map((show: any) => (
                  <div key={show.id} style={{ background: "white", borderRadius: "12px", padding: "20px", border: "1px solid rgba(14,12,10,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "#0E0C0A", marginBottom: "6px" }}>{show.title}</div>
                      <div style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.55 }}>📍 {show.venue} · {show.city}</div>
                      <div style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.55 }}>📅 {show.date}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: 700, color: "#C8441A", marginBottom: "8px" }}>₹{show.price}</div>
                      <Link href={`/events/${show.id}`} style={{ background: "#0E0C0A", color: "white", padding: "10px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>Book Now</Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REVIEWS */}
          {activeTab === "reviews" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "48px", fontWeight: 900, color: "#0E0C0A" }}>{artist.rating}</div>
                <div>
                  <div style={{ fontSize: "20px", marginBottom: "4px" }}>⭐⭐⭐⭐⭐</div>
                  <div style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.5 }}>{artist.reviews.length * 12} audience reviews</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {artist.reviews.map((r: any) => (
                  <div key={r.name} style={{ background: "white", borderRadius: "12px", padding: "20px", border: "1px solid rgba(14,12,10,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#C8441A", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "14px" }}>{r.name[0]}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "14px", color: "#0E0C0A" }}>{r.name}</div>
                          <div style={{ fontSize: "11px", color: "#0E0C0A", opacity: 0.4 }}>at {r.show}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: "12px", color: "#0E0C0A", opacity: 0.4 }}>{r.date}</span>
                    </div>
                    <div style={{ fontSize: "14px", marginBottom: "6px" }}>{"⭐".repeat(r.rating)}</div>
                    <p style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.7, lineHeight: 1.6 }}>{r.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Social */}
          <div style={{ background: "white", borderRadius: "12px", padding: "20px", border: "1px solid rgba(14,12,10,0.08)" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "16px", fontWeight: 700, color: "#0E0C0A", marginBottom: "16px" }}>Connect</div>
            {Object.entries(artist.socialLinks).map(([platform, handle]) => (
              <div key={platform} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "18px" }}>{platform === "instagram" ? "📸" : platform === "youtube" ? "▶️" : "🐦"}</span>
                <span style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.7 }}>{handle as string}</span>
              </div>
            ))}
          </div>

          {/* Book for event */}
          <div style={{ background: "#0E0C0A", borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "16px", fontWeight: 700, color: "white", marginBottom: "8px" }}>🎤 Book for your event</div>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: "16px" }}>Are you an organiser? Invite {artist.name} to perform at your event.</p>
            <Link href="/login" style={{ display: "block", background: "#C8441A", color: "white", padding: "12px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, textAlign: "center", textDecoration: "none" }}>
              Send Invitation
            </Link>
          </div>

          {/* Tip */}
          <div style={{ background: "white", borderRadius: "12px", padding: "20px", border: "1px solid rgba(14,12,10,0.08)" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "16px", fontWeight: 700, color: "#0E0C0A", marginBottom: "8px" }}>💸 Tip the Artist</div>
            <p style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.55, lineHeight: 1.6, marginBottom: "16px" }}>Loved their performance? Send a direct tip — 100% goes to the artist.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "12px" }}>
              {[50, 100, 200].map(amt => (
                <button key={amt} style={{ padding: "10px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.12)", background: "transparent", fontSize: "13px", fontWeight: 600, cursor: "pointer", color: "#0E0C0A" }}>₹{amt}</button>
              ))}
            </div>
            <Link href="/login" style={{ display: "block", background: "#F7F3EE", color: "#0E0C0A", padding: "12px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, textAlign: "center", textDecoration: "none" }}>
              Send Tip
            </Link>
          </div>

        </div>
      </div>
    </main>
  )
}