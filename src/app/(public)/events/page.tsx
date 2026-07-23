"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import SiteNav from "@/components/SiteNav"
import { getAvailabilityStatus, AVAILABILITY_BADGE } from "@/lib/availability"

interface EventItem {
  id: string
  title: string
  description: string
  type: string
  date: string
  startTime: string
  isFree: boolean
  ticketPrice: number | null
  totalSeats: number
  availableSeats: number
  vibe?: string | null
  venue: { name: string; city: string } | null
  lineup: { id: string }[]
}

const TYPE_META: Record<string, { emoji: string; color: string; label: string }> = {
  OPEN_MIC: { emoji: "🎤", color: "#001a10", label: "Open Mic" },
  STAND_UP: { emoji: "😂", color: "#1a0500", label: "Stand Up" },
  POETRY: { emoji: "📜", color: "#0a001a", label: "Poetry" },
  THEATER: { emoji: "🎩", color: "#1a0a1a", label: "Theater" },
  LINEUP: { emoji: "🌟", color: "#1a1000", label: "Lineup" },
}

const TYPE_OPTIONS = ["All", ...Object.keys(TYPE_META)]

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [selectedType, setSelectedType] = useState("All")
  const [selectedCity, setSelectedCity] = useState("All Cities")
  const [priceFilter, setPriceFilter] = useState("All")
  const [view, setView] = useState<"grid" | "list">("grid")

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch("/api/events")
        if (!res.ok) throw new Error("Failed to load events")
        const data = await res.json()
        setEvents(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchEvents()
  }, [])

  const cities = Array.from(new Set(events.map((e) => e.venue?.city).filter(Boolean))) as string[]

  const filtered = events.filter((e) => {
    const matchSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.venue?.name || "").toLowerCase().includes(search.toLowerCase())
    const matchType = selectedType === "All" || e.type === selectedType
    const matchCity = selectedCity === "All Cities" || e.venue?.city === selectedCity
    const matchPrice =
      priceFilter === "All" || (priceFilter === "Free" && e.isFree) || (priceFilter === "Paid" && !e.isFree)
    return matchSearch && matchType && matchCity && matchPrice
  })

  return (
    <main style={{ minHeight: "100vh", background: "#F7F3EE", fontFamily: "system-ui, sans-serif" }}>
      <SiteNav active="events" />

      {/* HERO SEARCH */}
      <div style={{ background: "#0E0C0A", padding: "56px 48px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 900, color: "white", marginBottom: "8px", lineHeight: 1.1 }}>
            Find your next <em style={{ color: "#C8441A", fontStyle: "italic" }}>live experience</em>
          </div>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.5)", marginBottom: "32px" }}>
            {loading ? "Loading events..." : `${filtered.length} events happening near you`}
          </p>
          <div style={{ position: "relative" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events, venues..."
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
        <style>{`
          .events-filters-row { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
          .events-filters-divider { width: 1px; height: 32px; background: rgba(14,12,10,0.1); flex-shrink: 0; }
          .events-filters-select { padding: 8px 14px; border-radius: 8px; border: 1.5px solid rgba(14,12,10,0.12); font-size: 13px; color: #0E0C0A; background: white; cursor: pointer; outline: none; }
          .events-filters-view-toggle { margin-left: auto; display: flex; gap: 4px; }
          @media (max-width: 780px) {
            .events-filters-row { flex-direction: column; align-items: stretch; gap: 12px; }
            .events-filters-divider { display: none; }
            .events-filters-select { width: 100%; box-sizing: border-box; }
            .events-filters-view-toggle { display: none; }
          }
        `}</style>
        <div style={{ background: "white", borderRadius: "12px", padding: "20px 24px", marginBottom: "24px", border: "1px solid rgba(14,12,10,0.08)" }}>
          <div className="events-filters-row">
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {TYPE_OPTIONS.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  style={{
                    padding: "7px 14px", borderRadius: "99px",
                    border: `1.5px solid ${selectedType === type ? "#C8441A" : "rgba(14,12,10,0.12)"}`,
                    background: selectedType === type ? "#C8441A" : "transparent",
                    color: selectedType === type ? "white" : "#0E0C0A",
                    fontSize: "13px", fontWeight: 500, cursor: "pointer",
                  }}
                >
                  {type === "All" ? "All" : TYPE_META[type].label}
                </button>
              ))}
            </div>

            <div className="events-filters-divider" />

            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="events-filters-select"
            >
              <option>All Cities</option>
              {cities.map((c) => <option key={c}>{c}</option>)}
            </select>

            <div style={{ display: "flex", gap: "6px" }}>
              {["All", "Free", "Paid"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPriceFilter(p)}
                  style={{
                    padding: "7px 14px", borderRadius: "99px",
                    border: `1.5px solid ${priceFilter === p ? "#C8441A" : "rgba(14,12,10,0.12)"}`,
                    background: priceFilter === p ? "#FFF5F2" : "transparent",
                    color: priceFilter === p ? "#C8441A" : "#0E0C0A",
                    fontSize: "13px", fontWeight: 500, cursor: "pointer",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="events-filters-view-toggle">
              <button onClick={() => setView("grid")} style={{ padding: "8px 12px", borderRadius: "6px", border: "none", background: view === "grid" ? "#0E0C0A" : "transparent", color: view === "grid" ? "white" : "#0E0C0A", cursor: "pointer", fontSize: "16px" }}>⊞</button>
              <button onClick={() => setView("list")} style={{ padding: "8px 12px", borderRadius: "6px", border: "none", background: view === "list" ? "#0E0C0A" : "transparent", color: view === "list" ? "white" : "#0E0C0A", cursor: "pointer", fontSize: "16px" }}>☰</button>
            </div>
          </div>
        </div>

        <p style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.6, marginBottom: "20px" }}>
          Showing <strong style={{ color: "#0E0C0A", opacity: 1 }}>{filtered.length}</strong> events
        </p>

        {/* EVENTS GRID */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#0E0C0A", opacity: 0.5 }}>Loading events...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: "64px", marginBottom: "16px" }}>🎭</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "#0E0C0A", marginBottom: "8px" }}>
              {events.length === 0 ? "No events published yet" : "No events found"}
            </div>
            <p style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.5 }}>
              {events.length === 0 ? "Check back soon — organisers are setting things up." : "Try adjusting your filters"}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: view === "grid" ? "repeat(auto-fill, minmax(340px, 1fr))" : "1fr", gap: "20px" }}>
            {filtered.map((event) => {
              const meta = TYPE_META[event.type] || TYPE_META.OPEN_MIC
              return (
                <div
                  key={event.id}
                  style={{ background: "white", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(14,12,10,0.08)", transition: "transform 0.2s, box-shadow 0.2s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 40px rgba(0,0,0,0.1)" }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none" }}
                >
                  {view === "grid" && (
                    <div style={{ height: "160px", background: meta.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "64px", position: "relative" }}>
                      {meta.emoji}
                      <span style={{ position: "absolute", top: "12px", left: "12px", background: "#C8441A", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "4px", letterSpacing: "0.05em" }}>
                        {meta.label.toUpperCase()}
                      </span>
                      <span style={{ position: "absolute", top: "12px", right: "12px", background: event.isFree ? "#2D6A4F" : "rgba(201,151,58,0.9)", color: "white", fontSize: "12px", fontWeight: 600, padding: "4px 10px", borderRadius: "4px" }}>
                        {event.isFree ? "FREE" : event.ticketPrice ? `₹${event.ticketPrice}` : "—"}
                      </span>
                      {(() => {
                        const status = getAvailabilityStatus(event.totalSeats, event.availableSeats)
                        if (status === 'available') return null
                        const badge = AVAILABILITY_BADGE[status]
                        return (
                          <span style={{ position: "absolute", bottom: "12px", right: "12px", background: badge.bg, color: badge.color, fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "4px" }}>
                            {status === 'filling-fast' ? `🔥 ${badge.label} · ${event.availableSeats} left` : badge.label}
                          </span>
                        )
                      })()}
                    </div>
                  )}

                  <div style={{ padding: "20px", display: view === "list" ? "flex" : "block", gap: "24px", alignItems: "center" }}>
                    {view === "list" && (
                      <div style={{ width: "60px", height: "60px", background: meta.color, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", flexShrink: 0 }}>
                        {meta.emoji}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "11px", fontFamily: "monospace", color: "#C8441A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>
                        {event.venue ? `${event.venue.name} · ${event.venue.city}` : "Venue TBD"}
                      </div>
                      <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "#0E0C0A", marginBottom: "8px", lineHeight: 1.2 }}>
                        {event.title}
                      </div>
                      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "12px" }}>
                        <span style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.6 }}>📅 {new Date(event.date).toLocaleDateString()}</span>
                        <span style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.6 }}>🕐 {event.startTime}</span>
                        {event.lineup.length > 0 && (
                          <span style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.6 }}>🎤 {event.lineup.length} performing</span>
                        )}
                      </div>
                      {view === "list" && (
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <span style={{ background: event.isFree ? "#2D6A4F" : "#C8441A", color: "white", fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "4px" }}>
                            {event.isFree ? "FREE" : event.ticketPrice ? `₹${event.ticketPrice}` : "—"}
                          </span>
                          <span style={{ fontSize: "12px", color: "#0E0C0A", opacity: 0.5 }}>{meta.label}</span>
                          {(() => {
                            const status = getAvailabilityStatus(event.totalSeats, event.availableSeats)
                            if (status === 'available') return null
                            const badge = AVAILABILITY_BADGE[status]
                            return (
                              <span style={{ fontSize: "12px", color: status === 'sold-out' ? "#0E0C0A" : "#ef4444", fontWeight: 600 }}>
                                {status === 'filling-fast' ? `🔥 ${badge.label} · ${event.availableSeats} left` : badge.label}
                              </span>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginTop: view === "grid" ? "12px" : "0", flexShrink: 0 }}>
                      <Link href={`/events/${event.id}`} style={{ background: "#0E0C0A", color: "white", padding: "10px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>
                        View Event
                      </Link>
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
