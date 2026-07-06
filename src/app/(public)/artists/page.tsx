"use client"
import { useState } from "react"
import Link from "next/link"
import SiteNav from "@/components/SiteNav"

const ARTISTS = [
  { id: "1", name: "Rohit Shah", genre: "Stand Up", subGenre: "Dark Comedy", city: "Mumbai", emoji: "😄", color: "#1a0500", rating: 4.8, shows: 320, followers: 12400, styleTag: ["Dark Humor", "Political"], upcoming: 2 },
  { id: "2", name: "Priya Menon", genre: "Poetry", subGenre: "Spoken Word", city: "Delhi", emoji: "✍️", color: "#0a001a", rating: 4.6, shows: 85, followers: 5200, styleTag: ["Emotional", "Feminist"], upcoming: 1 },
  { id: "3", name: "Karan Dev", genre: "Stand Up", subGenre: "Observational", city: "Bangalore", emoji: "🎭", color: "#001a00", rating: 4.9, shows: 200, followers: 28000, styleTag: ["Storytelling", "Clean"], upcoming: 3 },
  { id: "4", name: "Ananya Krishnan", genre: "Poetry", subGenre: "Sufi & Classical", city: "Hyderabad", emoji: "🌙", color: "#0a0a1a", rating: 4.7, shows: 145, followers: 8900, styleTag: ["Sufi", "Hindi"], upcoming: 1 },
  { id: "5", name: "Vikram Nair", genre: "Open Mic", subGenre: "Multi-genre", city: "Chennai", emoji: "🎤", color: "#1a0a00", rating: 4.5, shows: 60, followers: 3100, styleTag: ["Versatile", "Energetic"], upcoming: 2 },
  { id: "6", name: "Meera Joshi", genre: "Theater", subGenre: "Experimental", city: "Pune", emoji: "🎩", color: "#1a0a1a", rating: 4.8, shows: 95, followers: 6700, styleTag: ["Dramatic", "Visual"], upcoming: 1 },
]

const GENRES = ["All", "Stand Up", "Poetry", "Open Mic", "Theater"]
const CITIES = ["All Cities", "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Pune"]

export default function ArtistsPage() {
  const [search, setSearch] = useState("")
  const [selectedGenre, setSelectedGenre] = useState("All")
  const [selectedCity, setSelectedCity] = useState("All Cities")
  const [sortBy, setSortBy] = useState("rating")

  const filtered = ARTISTS
    .filter(a => {
      const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.subGenre.toLowerCase().includes(search.toLowerCase())
      const matchGenre = selectedGenre === "All" || a.genre === selectedGenre
      const matchCity = selectedCity === "All Cities" || a.city === selectedCity
      return matchSearch && matchGenre && matchCity
    })
    .sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating
      if (sortBy === "shows") return b.shows - a.shows
      if (sortBy === "followers") return b.followers - a.followers
      return 0
    })

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
            {filtered.length} artists performing live across India
          </p>
          <div style={{ position: "relative" }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search artists, genres..."
              style={{ width: "100%", padding: "18px 56px 18px 20px", borderRadius: "10px", border: "none", fontSize: "16px", background: "white", color: "#0E0C0A", outline: "none", boxSizing: "border-box" }}
            />
            <span style={{ position: "absolute", right: "20px", top: "50%", transform: "translateY(-50%)", fontSize: "20px" }}>🔍</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>

        {/* FILTERS */}
        <div style={{ background: "white", borderRadius: "12px", padding: "20px 24px", marginBottom: "24px", border: "1px solid rgba(14,12,10,0.08)", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {GENRES.map(g => (
              <button key={g} onClick={() => setSelectedGenre(g)} style={{ padding: "7px 14px", borderRadius: "99px", border: `1.5px solid ${selectedGenre === g ? "#C8441A" : "rgba(14,12,10,0.12)"}`, background: selectedGenre === g ? "#C8441A" : "transparent", color: selectedGenre === g ? "white" : "#0E0C0A", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>
                {g}
              </button>
            ))}
          </div>
          <div style={{ width: "1px", height: "32px", background: "rgba(14,12,10,0.1)" }} />
          <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} style={{ padding: "8px 14px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.12)", fontSize: "13px", color: "#0E0C0A", background: "white", cursor: "pointer", outline: "none" }}>
            {CITIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <div style={{ marginLeft: "auto" }}>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: "8px 14px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.12)", fontSize: "13px", color: "#0E0C0A", background: "white", cursor: "pointer", outline: "none" }}>
              <option value="rating">Sort: Rating</option>
              <option value="shows">Sort: Most Shows</option>
              <option value="followers">Sort: Followers</option>
            </select>
          </div>
        </div>

        {/* RISING STAR */}
        <div style={{ background: "linear-gradient(135deg, #1a0500, #C8441A)", borderRadius: "16px", padding: "24px 32px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "24px" }}>
          <div style={{ fontSize: "56px" }}>🌟</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: "4px" }}>Rising Star of the Week</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "white", marginBottom: "4px" }}>Karan Dev</div>
            <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)" }}>3 upcoming shows · 4.9 rating · Bangalore</div>
          </div>
          <Link href="/artists/3" style={{ background: "white", color: "#C8441A", padding: "12px 24px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>View Profile</Link>
        </div>

        {/* ARTIST GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
          {filtered.map(artist => (
            <Link key={artist.id} href={`/artists/${artist.id}`} style={{ textDecoration: "none" }}>
              <div style={{ background: "white", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(14,12,10,0.08)", transition: "transform 0.2s, box-shadow 0.2s", cursor: "pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 40px rgba(0,0,0,0.1)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none" }}
              >
                {/* Card Header */}
                <div style={{ height: "120px", background: artist.color, display: "flex", alignItems: "center", padding: "24px", gap: "16px", position: "relative" }}>
                  <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "3px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", flexShrink: 0 }}>
                    {artist.emoji}
                  </div>
                  <div>
                    <div style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: 700, color: "white", marginBottom: "4px" }}>{artist.name}</div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>{artist.subGenre} · {artist.city}</div>
                  </div>
                  {artist.upcoming > 0 && (
                    <div style={{ position: "absolute", top: "12px", right: "12px", background: "#C8441A", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "4px" }}>
                      {artist.upcoming} upcoming
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
                    {artist.styleTag.map(tag => (
                      <span key={tag} style={{ background: "#F7F3EE", color: "#0E0C0A", fontSize: "11px", padding: "3px 10px", borderRadius: "99px", fontWeight: 500 }}>{tag}</span>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "#0E0C0A" }}>⭐ {artist.rating}</div>
                      <div style={{ fontSize: "11px", color: "#0E0C0A", opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Rating</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "#0E0C0A" }}>{artist.shows}</div>
                      <div style={{ fontSize: "11px", color: "#0E0C0A", opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Shows</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "#0E0C0A" }}>{(artist.followers / 1000).toFixed(1)}k</div>
                      <div style={{ fontSize: "11px", color: "#0E0C0A", opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Followers</div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}