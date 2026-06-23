"use client"
import { useState } from "react"
import Link from "next/link"

const EVENT_TYPES = ["All", "Open Mic", "Stand Up", "Poetry", "Theater", "Lineup"]
const CITIES = ["All Cities", "Mumbai", "Delhi", "Bangalore", "Pune", "Hyderabad", "Chennai", "Kolkata"]
const RASAS = ["All Moods", "❤️ Love", "😂 Laughter", "😢 Sorrow", "⚡ Fury", "🦁 Courage", "🤩 Wonder", "🕊️ Peace"]

const MOCK_EVENTS = [
  { id: "1", title: "Midnight Laughs Vol. 12", type: "Stand Up", city: "Mumbai", venue: "The Comedy Store", date: "Sat, 28 Jun", time: "9:00 PM", price: 399, isFree: false, food: "Drinks on house", emoji: "🎤", color: "#1a0500", performers: ["😄", "😂", "🎭"], seats: 24, rasa: "😂 Laughter" },
  { id: "2", title: "Words That Wound & Heal", type: "Poetry", city: "Delhi", venue: "Prithvi Theatre", date: "Fri, 27 Jun", time: "7:00 PM", price: 0, isFree: true, food: "Tea included", emoji: "📜", color: "#0a001a", performers: ["✍️", "📖", "🖊️"], seats: 12, rasa: "😢 Sorrow" },
  { id: "3", title: "Raw Stage — Open to All", type: "Open Mic", city: "Bangalore", venue: "Humming Tree", date: "Sun, 29 Jun", time: "6:30 PM", price: 199, isFree: false, food: "Bar available", emoji: "🎭", color: "#001a00", performers: ["🎤", "🎵", "🎶"], seats: 45, rasa: "😂 Laughter" },
  { id: "4", title: "The Dark Side of Comedy", type: "Stand Up", city: "Pune", venue: "Blue Frog", date: "Sat, 28 Jun", time: "8:00 PM", price: 299, isFree: false, food: "Full menu", emoji: "🎪", color: "#1a0a00", performers: ["😈", "😏", "🎭"], seats: 8, rasa: "😂 Laughter" },
  { id: "5", title: "Sufi Poetry Night", type: "Poetry", city: "Hyderabad", venue: "Lamakaan", date: "Fri, 27 Jun", time: "6:00 PM", price: 0, isFree: true, food: "Chai & snacks", emoji: "🌙", color: "#0a0a1a", performers: ["🎵", "✍️", "🌹"], seats: 30, rasa: "❤️ Love" },
  { id: "6", title: "Open Mic Thursdays", type: "Open Mic", city: "Chennai", venue: "Sarjapur Stage", date: "Thu, 26 Jun", time: "7:30 PM", price: 149, isFree: false, food: "Snacks available", emoji: "🎤", color: "#001a10", performers: ["🎤", "😄", "🎭"], seats: 20, rasa: "😂 Laughter" },
  { id: "7", title: "Shakespearean Reimagined", type: "Theater", city: "Kolkata", venue: "Academy of Fine Arts", date: "Sun, 29 Jun", time: "5:00 PM", price: 499, isFree: false, food: "Interval snacks", emoji: "🎩", color: "#1a0a1a", performers: ["🎭", "👑", "⚔️"], seats: 60, rasa: "🤩 Wonder" },
  { id: "8", title: "Comedy Lineup — Best of 2025", type: "Lineup", city: "Mumbai", venue: "NCPA", date: "Sat, 28 Jun", time: "7:00 PM", price: 799, isFree: false, food: "Premium bar", emoji: "🌟", color: "#1a1000", performers: ["⭐", "🌟", "💫"], seats: 3, rasa: "😂 Laughter" },
  { id: "9", title: "Spoken Word Revolution", type: "Poetry", city: "Bangalore", venue: "Rangoli Metro Art", date: "Mon, 30 Jun", time: "6:00 PM", price: 0, isFree: true, food: "None", emoji: "✊", color: "#0a1a00", performers: ["✊", "📢", "🎤"], seats: 50, rasa: "⚡ Fury" },
]

export default function EventsPage() {
  const [search, setSearch] = useState("")
  const [selectedType, setSelectedType] = useState("All")
  const [selectedCity, setSelectedCity] = useState("All Cities")
  const [selectedRasa, setSelectedRasa] = useState("All Moods")
  const [priceFilter, setPriceFilter] = useState("All")
  const [view, setView] = useState<"grid" | "list">("grid")

  const filtered = MOCK_EVENTS.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) || e.venue.toLowerCase().includes(search.toLowerCase())
    const matchType = selectedType === "All" || e.type === selectedType
    const matchCity = selectedCity === "All Cities" || e.city === selectedCity
    const matchRasa = selectedRasa === "All Moods" || e.rasa === selectedRasa
    const matchPrice = priceFilter === "All" || (priceFilter === "Free" && e.isFree) || (priceFilter === "Paid" && !e.isFree)
    return matchSearch && matchType && matchCity && matchRasa && matchPrice
  })

  return (
    <main style={{ minHeight: "100vh", background: "#F7F3EE", fontFamily: "system-ui, sans-serif" }}>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 48px", background: "rgba(247,243,238,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(14,12,10,0.08)" }}>
        <Link href="/" style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: 700, color: "#0E0C0A", textDecoration: "none" }}>
          <span style={{ color: "#C8441A" }}>A</span>forAudience
        </Link>
        <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          <Link href="/events" style={{ fontSize: "14px", fontWeight: 600, color: "#C8441A", textDecoration: "none" }}>Events</Link>
          <Link href="/artists" style={{ fontSize: "14px", color: "#0E0C0A", textDecoration: "none", opacity: 0.6 }}>Artists</Link>
          <Link href="/login" style={{ fontSize: "14px", fontWeight: 600, color: "#F7F3EE", textDecoration: "none", background: "#0E0C0A", padding: "8px 20px", borderRadius: "6px" }}>Sign In</Link>
        </div>
      </nav>

      {/* HERO SEARCH */}
      <div style={{ background: "#0E0C0A", padding: "56px 48px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 900, color: "white", marginBottom: "8px", lineHeight: 1.1 }}>
            Find your next <em style={{ color: "#C8441A", fontStyle: "italic" }}>live experience</em>
          </div>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.5)", marginBottom: "32px" }}>
            {filtered.length} events happening near you
          </p>
          <div style={{ position: "relative" }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search events, artists, venues..."
              style={{ width: "100%", padding: "18px 56px 18px 20px", borderRadius: "10px", border: "none", fontSize: "16px", background: "white", color: "#0E0C0A", outline: "none", boxSizing: "border-box" }}
            />
            <span style={{ position: "absolute", right: "20px", top: "50%", transform: "translateY(-50%)", fontSize: "20px" }}>🔍</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>

        {/* FILTERS */}
        <div style={{ background: "white", borderRadius: "12px", padding: "20px 24px", marginBottom: "24px", border: "1px solid rgba(14,12,10,0.08)" }}>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>

            {/* Event Type */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {EVENT_TYPES.map(type => (
                <button key={type} onClick={() => setSelectedType(type)} style={{ padding: "7px 14px", borderRadius: "99px", border: `1.5px solid ${selectedType === type ? "#C8441A" : "rgba(14,12,10,0.12)"}`, background: selectedType === type ? "#C8441A" : "transparent", color: selectedType === type ? "white" : "#0E0C0A", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>
                  {type}
                </button>
              ))}
            </div>

            <div style={{ width: "1px", height: "32px", background: "rgba(14,12,10,0.1)" }} />

            {/* City */}
            <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} style={{ padding: "8px 14px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.12)", fontSize: "13px", color: "#0E0C0A", background: "white", cursor: "pointer", outline: "none" }}>
              {CITIES.map(c => <option key={c}>{c}</option>)}
            </select>

            {/* Rasa */}
            <select value={selectedRasa} onChange={e => setSelectedRasa(e.target.value)} style={{ padding: "8px 14px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.12)", fontSize: "13px", color: "#0E0C0A", background: "white", cursor: "pointer", outline: "none" }}>
              {RASAS.map(r => <option key={r}>{r}</option>)}
            </select>

            {/* Price */}
            <div style={{ display: "flex", gap: "6px" }}>
              {["All", "Free", "Paid"].map(p => (
                <button key={p} onClick={() => setPriceFilter(p)} style={{ padding: "7px 14px", borderRadius: "99px", border: `1.5px solid ${priceFilter === p ? "#C8441A" : "rgba(14,12,10,0.12)"}`, background: priceFilter === p ? "#FFF5F2" : "transparent", color: priceFilter === p ? "#C8441A" : "#0E0C0A", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>
                  {p}
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
              <button onClick={() => setView("grid")} style={{ padding: "8px 12px", borderRadius: "6px", border: "none", background: view === "grid" ? "#0E0C0A" : "transparent", color: view === "grid" ? "white" : "#0E0C0A", cursor: "pointer", fontSize: "16px" }}>⊞</button>
              <button onClick={() => setView("list")} style={{ padding: "8px 12px", borderRadius: "6px", border: "none", background: view === "list" ? "#0E0C0A" : "transparent", color: view === "list" ? "white" : "#0E0C0A", cursor: "pointer", fontSize: "16px" }}>☰</button>
            </div>
          </div>
        </div>

        {/* RESULTS COUNT */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <p style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.6 }}>
            Showing <strong style={{ color: "#0E0C0A", opacity: 1 }}>{filtered.length}</strong> events
          </p>
          <select style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(14,12,10,0.12)", fontSize: "13px", color: "#0E0C0A", background: "white", outline: "none" }}>
            <option>Sort: Date</option>
            <option>Sort: Price Low</option>
            <option>Sort: Price High</option>
            <option>Sort: Seats Left</option>
          </select>
        </div>

        {/* EVENTS GRID */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: "64px", marginBottom: "16px" }}>🎭</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "#0E0C0A", marginBottom: "8px" }}>No events found</div>
            <p style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.5 }}>Try adjusting your filters</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: view === "grid" ? "repeat(auto-fill, minmax(340px, 1fr))" : "1fr", gap: "20px" }}>
            {filtered.map(event => (
              <div key={event.id} style={{ background: "white", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(14,12,10,0.08)", transition: "transform 0.2s, box-shadow 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 40px rgba(0,0,0,0.1)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none" }}
              >
                {/* Card Header */}
                {view === "grid" && (
                  <div style={{ height: "160px", background: event.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "64px", position: "relative" }}>
                    {event.emoji}
                    <span style={{ position: "absolute", top: "12px", left: "12px", background: "#C8441A", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "4px", letterSpacing: "0.05em" }}>{event.type.toUpperCase()}</span>
                    <span style={{ position: "absolute", top: "12px", right: "12px", background: event.isFree ? "#2D6A4F" : "rgba(201,151,58,0.9)", color: "white", fontSize: "12px", fontWeight: 600, padding: "4px 10px", borderRadius: "4px" }}>
                      {event.isFree ? "FREE" : `₹${event.price}`}
                    </span>
                    {event.seats < 10 && (
                      <span style={{ position: "absolute", bottom: "12px", right: "12px", background: "#ef4444", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "4px" }}>
                        🔥 {event.seats} seats left
                      </span>
                    )}
                  </div>
                )}

                {/* Card Body */}
                <div style={{ padding: "20px", display: view === "list" ? "flex" : "block", gap: "24px", alignItems: "center" }}>
                  {view === "list" && (
                    <div style={{ width: "60px", height: "60px", background: event.color, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", flexShrink: 0 }}>
                      {event.emoji}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "11px", fontFamily: "monospace", color: "#C8441A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>{event.venue} · {event.city}</div>
                    <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "#0E0C0A", marginBottom: "8px", lineHeight: 1.2 }}>{event.title}</div>
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "12px" }}>
                      <span style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.6 }}>📅 {event.date}</span>
                      <span style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.6 }}>🕐 {event.time}</span>
                      <span style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.6 }}>🍽️ {event.food}</span>
                    </div>
                    {view === "list" && (
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={{ background: event.isFree ? "#2D6A4F" : "#C8441A", color: "white", fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "4px" }}>
                          {event.isFree ? "FREE" : `₹${event.price}`}
                        </span>
                        <span style={{ fontSize: "12px", color: "#0E0C0A", opacity: 0.5 }}>{event.type}</span>
                        {event.seats < 10 && <span style={{ fontSize: "12px", color: "#ef4444", fontWeight: 600 }}>🔥 {event.seats} left</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: view === "grid" ? "12px" : "0", flexShrink: 0 }}>
                    <div style={{ display: "flex", gap: "-4px" }}>
                      {event.performers.map((p, i) => (
                        <span key={i} style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#F7F3EE", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "14px", marginLeft: i > 0 ? "-6px" : "0", border: "2px solid white" }}>{p}</span>
                      ))}
                    </div>
                    <Link href={`/events/${event.id}`} style={{ background: "#0E0C0A", color: "white", padding: "10px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, textDecoration: "none", marginLeft: "12px" }}>
                      Book Now
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LOAD MORE */}
        <div style={{ textAlign: "center", marginTop: "48px", paddingBottom: "48px" }}>
          <button style={{ background: "transparent", border: "1.5px solid rgba(14,12,10,0.2)", color: "#0E0C0A", padding: "14px 40px", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>
            Load more events
          </button>
        </div>
      </div>
    </main>
  )
}