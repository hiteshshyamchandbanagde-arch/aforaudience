"use client"
import { useState } from "react"
import { useSession } from "next-auth/react"
import SiteNav from "@/components/SiteNav"
import AuthPromptSheet from "@/components/AuthPromptSheet"

interface Performer {
  id: string
  slot: number
  duration: number
  artist: {
    bio?: string | null
    genre: string[]
    styleTag: string[]
    hypScore: number
    user: { name: string }
  }
}

interface TicketTier {
  id: string
  sectionName: string
  price: number
  totalSeats: number
}

interface EventData {
  id: string
  title: string
  description: string
  type: string
  date: string
  startTime: string
  endTime: string
  isFree: boolean
  ticketPrice: number | null
  totalSeats: number
  availableSeats: number
  maxSeatsPerBooking: number
  dresscode?: string | null
  vibe?: string | null
  surpriseAct: boolean
  venue: { name: string; address: string; city: string; facilities: string[] } | null
  lineup: Performer[]
  ticketTiers: TicketTier[]
}

const TYPE_META: Record<string, { emoji: string; color: string; label: string }> = {
  OPEN_MIC: { emoji: "🎤", color: "#001a10", label: "Open Mic" },
  STAND_UP: { emoji: "😂", color: "#1a0500", label: "Stand Up" },
  POETRY: { emoji: "📜", color: "#0a001a", label: "Poetry" },
  THEATER: { emoji: "🎩", color: "#1a0a1a", label: "Theater" },
  LINEUP: { emoji: "🌟", color: "#1a1000", label: "Lineup" },
}

export default function EventDetailPage({ event }: { event: EventData | null }) {
  const { status } = useSession()
  const [activeTab, setActiveTab] = useState<"overview" | "lineup" | "venue">("overview")
  const [selectedSeats, setSelectedSeats] = useState<Record<string, number>>({})
  const [showAuthSheet, setShowAuthSheet] = useState(false)
  const [reserving, setReserving] = useState(false)
  const [reservedMessage, setReservedMessage] = useState("")
  const [bookingError, setBookingError] = useState("")

  const totalSelected = Object.values(selectedSeats).reduce((sum, q) => sum + q, 0)
  const totalAmount = event
    ? event.ticketTiers.length > 0
      ? event.ticketTiers.reduce((sum, t) => sum + (selectedSeats[t.sectionName] || 0) * t.price, 0)
      : (selectedSeats['General'] || 0) * (event.ticketPrice || 0)
    : 0

  const updateSeat = (section: string, delta: number, max: number) => {
    setSelectedSeats((prev) => {
      const current = prev[section] || 0
      const next = Math.max(0, Math.min(current + delta, max, event?.maxSeatsPerBooking || 4))
      const otherTotal = totalSelected - current
      if (otherTotal + next > (event?.maxSeatsPerBooking || 4)) return prev
      return { ...prev, [section]: next }
    })
  }

  const reserveSeats = async () => {
    if (!event) return
    setReserving(true)
    setBookingError("")
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, seats: selectedSeats }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to reserve seats")
      setReservedMessage(data.message)
    } catch (err: any) {
      setBookingError(err.message)
    } finally {
      setReserving(false)
    }
  }

  const handleBookClick = () => {
    if (totalSelected === 0) {
      setBookingError("Select at least one seat first")
      return
    }
    if (status !== "authenticated") {
      setShowAuthSheet(true)
      return
    }
    reserveSeats()
  }

  if (!event) {
    return (
      <main style={{ minHeight: "100vh", background: "#F7F3EE", fontFamily: "system-ui, sans-serif" }}>
        <SiteNav backHref="/events" backLabel="← Back to Events" />
        <div style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px" }}>Event not found.</div>
      </main>
    )
  }

  const meta = TYPE_META[event.type] || TYPE_META.OPEN_MIC

  return (
    <main style={{ minHeight: "100vh", background: "#F7F3EE", fontFamily: "system-ui, sans-serif" }}>
      <SiteNav backHref="/events" backLabel="← Back to Events" />

      {/* HERO */}
      <div style={{ background: meta.color, padding: "64px 48px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: "48px", top: "50%", transform: "translateY(-50%)", fontSize: "160px", opacity: 0.15 }}>{meta.emoji}</div>
        <div style={{ maxWidth: "800px", position: "relative" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            <span style={{ background: "#C8441A", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: "4px", letterSpacing: "0.08em" }}>{meta.label.toUpperCase()}</span>
            {event.vibe && <span style={{ background: "rgba(255,255,255,0.15)", color: "white", fontSize: "11px", padding: "4px 12px", borderRadius: "4px" }}>⚡ {event.vibe}</span>}
            {event.isFree ? (
              <span style={{ background: "#2D6A4F", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: "4px" }}>FREE</span>
            ) : (
              <span style={{ background: "rgba(201,151,58,0.9)", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: "4px" }}>
                {event.ticketPrice ? `₹${event.ticketPrice} per seat` : "—"}
              </span>
            )}
          </div>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 900, color: "white", lineHeight: 1.05, marginBottom: "20px", letterSpacing: "-1px" }}>
            {event.title}
          </h1>
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
            {[
              { icon: "📅", text: new Date(event.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) },
              { icon: "🕐", text: `${event.startTime} – ${event.endTime}` },
              { icon: "📍", text: event.venue ? `${event.venue.name}, ${event.venue.city}` : "Venue TBD" },
            ].map((item) => (
              <div key={item.text} style={{ display: "flex", alignItems: "center", gap: "6px", color: "rgba(255,255,255,0.8)", fontSize: "14px" }}>
                <span>{item.icon}</span><span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px", display: "grid", gridTemplateColumns: "1fr 380px", gap: "32px" }}>
        {/* LEFT CONTENT */}
        <div>
          <div style={{ display: "flex", gap: "0", marginBottom: "32px", borderBottom: "2px solid rgba(14,12,10,0.1)" }}>
            {(["overview", "lineup", "venue"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{ padding: "12px 24px", border: "none", background: "transparent", fontSize: "14px", fontWeight: 600, color: activeTab === tab ? "#C8441A" : "#0E0C0A", cursor: "pointer", borderBottom: `2px solid ${activeTab === tab ? "#C8441A" : "transparent"}`, marginBottom: "-2px", textTransform: "capitalize" }}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#0E0C0A", marginBottom: "12px" }}>About this event</h2>
              <p style={{ fontSize: "15px", lineHeight: 1.8, color: "#0E0C0A", opacity: 0.75, marginBottom: "32px" }}>{event.description}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "32px" }}>
                {[
                  { label: "Dress Code", value: event.dresscode, icon: "👔" },
                  { label: "Vibe", value: event.vibe, icon: "⚡" },
                  { label: "Surprise Act", value: event.surpriseAct ? "Yes" : "No", icon: "🎁" },
                  { label: "Total Seats", value: String(event.totalSeats), icon: "💺" },
                ].filter((i) => i.value).map((item) => (
                  <div key={item.label} style={{ background: "white", borderRadius: "10px", padding: "16px", border: "1px solid rgba(14,12,10,0.08)" }}>
                    <div style={{ fontSize: "20px", marginBottom: "6px" }}>{item.icon}</div>
                    <div style={{ fontSize: "11px", color: "#0E0C0A", opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>{item.label}</div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#0E0C0A" }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "lineup" && (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#0E0C0A", marginBottom: "20px" }}>Lineup</h2>
              {event.lineup.length === 0 ? (
                <p style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.5 }}>Lineup hasn't been confirmed yet — check back closer to the date.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {event.lineup.map((p) => (
                    <div key={p.id} style={{ background: "white", borderRadius: "12px", padding: "20px", border: "1px solid rgba(14,12,10,0.08)", display: "flex", alignItems: "center", gap: "20px" }}>
                      <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: meta.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: 700, color: "white", flexShrink: 0 }}>
                        {p.artist.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "16px", color: "#0E0C0A", marginBottom: "4px" }}>{p.artist.user.name}</div>
                        {p.artist.genre.length > 0 && (
                          <div style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.55, marginBottom: "8px" }}>{p.artist.genre.join(", ")}</div>
                        )}
                        <div style={{ display: "flex", gap: "16px" }}>
                          <span style={{ fontSize: "13px", color: "#0E0C0A" }}>🔥 Hype {p.artist.hypScore.toFixed(1)}</span>
                          <span style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.5 }}>Slot #{p.slot} · {p.duration} min</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "venue" && (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#0E0C0A", marginBottom: "20px" }}>Venue Details</h2>
              {event.venue ? (
                <div style={{ background: "white", borderRadius: "12px", padding: "24px", border: "1px solid rgba(14,12,10,0.08)" }}>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: 700, color: "#0E0C0A", marginBottom: "8px" }}>{event.venue.name}</div>
                  <div style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.6, marginBottom: "16px" }}>📍 {event.venue.address}, {event.venue.city}</div>
                  {event.venue.facilities.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px" }}>
                      {event.venue.facilities.map((f) => (
                        <div key={f} style={{ background: "#F7F3EE", borderRadius: "8px", padding: "10px", textAlign: "center", fontSize: "13px", color: "#0E0C0A" }}>✅ {f}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.5 }}>Venue not confirmed yet.</p>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — INFO PANEL */}
        <div style={{ position: "sticky", top: "80px", height: "fit-content" }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "24px", border: "1px solid rgba(14,12,10,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
            {reservedMessage ? (
              <div>
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>✅</div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "#0E0C0A", marginBottom: "8px" }}>
                  Seats reserved
                </div>
                <p style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.7, lineHeight: 1.6 }}>{reservedMessage}</p>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#0E0C0A", marginBottom: "4px" }}>
                  {event.isFree ? "Free Entry" : event.ticketTiers.length > 0 ? "Choose your section" : event.ticketPrice ? `₹${event.ticketPrice} / seat` : "Price TBD"}
                </div>
                <div style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.5, marginBottom: "20px" }}>
                  {event.availableSeats} of {event.totalSeats} seats total · max {event.maxSeatsPerBooking} per booking
                </div>

                {!event.isFree && (
                  <div style={{ marginBottom: "16px" }}>
                    {event.ticketTiers.length > 0 ? (
                      event.ticketTiers.map((t) => (
                        <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(14,12,10,0.06)" }}>
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#0E0C0A" }}>{t.sectionName}</div>
                            <div style={{ fontSize: "11px", color: "#0E0C0A", opacity: 0.5 }}>₹{t.price}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <button onClick={() => updateSeat(t.sectionName, -1, t.totalSeats)} style={{ width: "26px", height: "26px", padding: 0, borderRadius: "6px", border: "1px solid rgba(14,12,10,0.2)", background: "#fff", cursor: "pointer" }}>−</button>
                            <span style={{ minWidth: "14px", textAlign: "center", fontSize: "13px" }}>{selectedSeats[t.sectionName] || 0}</span>
                            <button onClick={() => updateSeat(t.sectionName, 1, t.totalSeats)} style={{ width: "26px", height: "26px", padding: 0, borderRadius: "6px", border: "1px solid rgba(14,12,10,0.2)", background: "#fff", cursor: "pointer" }}>+</button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#0E0C0A" }}>General Admission</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <button onClick={() => updateSeat('General', -1, event.totalSeats)} style={{ width: "26px", height: "26px", padding: 0, borderRadius: "6px", border: "1px solid rgba(14,12,10,0.2)", background: "#fff", cursor: "pointer" }}>−</button>
                          <span style={{ minWidth: "14px", textAlign: "center", fontSize: "13px" }}>{selectedSeats['General'] || 0}</span>
                          <button onClick={() => updateSeat('General', 1, event.totalSeats)} style={{ width: "26px", height: "26px", padding: 0, borderRadius: "6px", border: "1px solid rgba(14,12,10,0.2)", background: "#fff", cursor: "pointer" }}>+</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {event.isFree && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", marginBottom: "8px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#0E0C0A" }}>Seats</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button onClick={() => updateSeat('General', -1, event.totalSeats)} style={{ width: "26px", height: "26px", padding: 0, borderRadius: "6px", border: "1px solid rgba(14,12,10,0.2)", background: "#fff", cursor: "pointer" }}>−</button>
                      <span style={{ minWidth: "14px", textAlign: "center", fontSize: "13px" }}>{selectedSeats['General'] || 0}</span>
                      <button onClick={() => updateSeat('General', 1, event.totalSeats)} style={{ width: "26px", height: "26px", padding: 0, borderRadius: "6px", border: "1px solid rgba(14,12,10,0.2)", background: "#fff", cursor: "pointer" }}>+</button>
                    </div>
                  </div>
                )}

                {bookingError && (
                  <div style={{ fontSize: "12px", color: "#B3261E", marginBottom: "12px" }}>{bookingError}</div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingTop: "12px", borderTop: "1px solid rgba(14,12,10,0.08)" }}>
                  <span style={{ fontSize: "12px", color: "#0E0C0A", opacity: 0.6 }}>{totalSelected} seat{totalSelected === 1 ? "" : "s"}</span>
                  <span style={{ fontSize: "18px", fontWeight: 700, color: "#0E0C0A" }}>{totalAmount > 0 ? `₹${totalAmount.toLocaleString("en-IN")}` : "Free"}</span>
                </div>

                <button
                  onClick={handleBookClick}
                  disabled={reserving}
                  style={{ display: "block", width: "100%", background: "#C8441A", color: "white", padding: "16px", borderRadius: "10px", border: "none", fontSize: "15px", fontWeight: 700, textAlign: "center", boxSizing: "border-box", marginBottom: "12px", cursor: reserving ? "default" : "pointer", opacity: reserving ? 0.7 : 1 }}
                >
                  {reserving ? "Reserving..." : "Reserve Seats"}
                </button>

                <div style={{ fontSize: "12px", color: "#0E0C0A", opacity: 0.45, textAlign: "center" }}>
                  Online payment isn't live yet — this reserves your seats, we'll email you when checkout is ready.
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <AuthPromptSheet
        open={showAuthSheet}
        onClose={() => setShowAuthSheet(false)}
        title="Sign in to reserve your seats"
        subtitle={`${totalSelected} seat${totalSelected === 1 ? "" : "s"}${totalAmount > 0 ? ` · ₹${totalAmount.toLocaleString("en-IN")}` : ""}`}
        onSuccess={() => {
          setShowAuthSheet(false)
          reserveSeats()
        }}
      />
    </main>
  )
}
