"use client"
import { useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import SiteNav from "@/components/SiteNav"
import AuthPromptSheet from "@/components/AuthPromptSheet"

const EVENT_DATA: Record<string, any> = {
  "1": {
    id: "1", title: "Midnight Laughs Vol. 12", type: "Stand Up", city: "Mumbai",
    venue: "The Comedy Store", address: "Andheri West, Mumbai 400058",
    date: "Saturday, 28 June 2025", time: "9:00 PM", duration: "2 hours",
    price: 399, isFree: false, emoji: "🎤", color: "#1a0500",
    food: "Drinks on house", dresscode: "Smart casual", vibe: "High Energy",
    description: "Mumbai's most loved stand-up comedy night returns for its 12th edition! Featuring 5 of the city's hottest comedians in an intimate setting. Expect sharp wit, dark humor and a night you won't forget. Drinks are on the house for the first round!",
    totalSeats: 60, bookedSeats: [1,2,5,8,12,15,19,23,24,25,36,45,52,58],
    performers: [
      { name: "Rohit Shah", genre: "Dark Comedy", emoji: "😄", rating: 4.8, shows: 120 },
      { name: "Priya Menon", genre: "Observational", emoji: "😂", rating: 4.6, shows: 85 },
      { name: "Karan Dev", genre: "Political", emoji: "🎭", rating: 4.9, shows: 200 },
    ],
    reviews: [
      { name: "Sneha R.", rating: 5, comment: "Absolutely brilliant! Karan Dev stole the show.", date: "Jun 15" },
      { name: "Amit K.", rating: 4, comment: "Great night out. Drinks policy is amazing!", date: "Jun 10" },
      { name: "Pooja S.", rating: 5, comment: "Best comedy night in Mumbai hands down.", date: "Jun 5" },
    ],
    rows: 6, cols: 10,
  }
}

export default function EventDetailPage({ params }: { params: { id: string } }) {
  const event = EVENT_DATA[params.id] || EVENT_DATA["1"]
  const { data: session, status } = useSession()
  const [selectedSeats, setSelectedSeats] = useState<number[]>([])
  const [activeTab, setActiveTab] = useState<"overview"|"lineup"|"reviews"|"venue">("overview")
  const [showAuthSheet, setShowAuthSheet] = useState(false)
  const [bookingConfirmed, setBookingConfirmed] = useState(false)

  const toggleSeat = (seat: number) => {
    if (event.bookedSeats.includes(seat)) return
    setSelectedSeats(prev =>
      prev.includes(seat) ? prev.filter(s => s !== seat) : prev.length < 4 ? [...prev, seat] : prev
    )
  }

  const totalAmount = selectedSeats.length * event.price

  const handleBookClick = () => {
    if (selectedSeats.length === 0) return
    if (status !== "authenticated") {
      setShowAuthSheet(true)
      return
    }
    setBookingConfirmed(true)
  }

  const handleAuthSuccess = () => {
    // Selected seats are preserved in state (no navigation happened), so the
    // booking resumes exactly where the user left off — per the "user lands
    // back exactly where they were, action already queued" rule.
    setShowAuthSheet(false)
    setBookingConfirmed(true)
  }

  return (
    <main style={{ minHeight: "100vh", background: "#F7F3EE", fontFamily: "system-ui, sans-serif" }}>

      <SiteNav backHref="/events" backLabel="← Back to Events" />

      {/* HERO */}
      <div style={{ background: event.color, padding: "64px 48px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: "48px", top: "50%", transform: "translateY(-50%)", fontSize: "160px", opacity: 0.15 }}>{event.emoji}</div>
        <div style={{ maxWidth: "800px", position: "relative" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            <span style={{ background: "#C8441A", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: "4px", letterSpacing: "0.08em" }}>{event.type.toUpperCase()}</span>
            <span style={{ background: "rgba(255,255,255,0.15)", color: "white", fontSize: "11px", padding: "4px 12px", borderRadius: "4px" }}>⚡ {event.vibe}</span>
            {event.isFree ? (
              <span style={{ background: "#2D6A4F", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: "4px" }}>FREE</span>
            ) : (
              <span style={{ background: "rgba(201,151,58,0.9)", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: "4px" }}>₹{event.price} per seat</span>
            )}
          </div>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 900, color: "white", lineHeight: 1.05, marginBottom: "20px", letterSpacing: "-1px" }}>
            {event.title}
          </h1>
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
            {[
              { icon: "📅", text: event.date },
              { icon: "🕐", text: event.time },
              { icon: "⏱️", text: event.duration },
              { icon: "📍", text: `${event.venue}, ${event.city}` },
            ].map(item => (
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
          {/* TABS */}
          <div style={{ display: "flex", gap: "0", marginBottom: "32px", borderBottom: "2px solid rgba(14,12,10,0.1)" }}>
            {(["overview", "lineup", "reviews", "venue"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "12px 24px", border: "none", background: "transparent", fontSize: "14px", fontWeight: 600, color: activeTab === tab ? "#C8441A" : "#0E0C0A", cursor: "pointer", borderBottom: `2px solid ${activeTab === tab ? "#C8441A" : "transparent"}`, marginBottom: "-2px", textTransform: "capitalize" }}>
                {tab}
              </button>
            ))}
          </div>

          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#0E0C0A", marginBottom: "12px" }}>About this event</h2>
              <p style={{ fontSize: "15px", lineHeight: 1.8, color: "#0E0C0A", opacity: 0.75, marginBottom: "32px" }}>{event.description}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "32px" }}>
                {[
                  { label: "Food & Drinks", value: event.food, icon: "🍽️" },
                  { label: "Dress Code", value: event.dresscode, icon: "👔" },
                  { label: "Vibe", value: event.vibe, icon: "⚡" },
                  { label: "Duration", value: event.duration, icon: "⏱️" },
                ].map(item => (
                  <div key={item.label} style={{ background: "white", borderRadius: "10px", padding: "16px", border: "1px solid rgba(14,12,10,0.08)" }}>
                    <div style={{ fontSize: "20px", marginBottom: "6px" }}>{item.icon}</div>
                    <div style={{ fontSize: "11px", color: "#0E0C0A", opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>{item.label}</div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#0E0C0A" }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LINEUP TAB */}
          {activeTab === "lineup" && (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#0E0C0A", marginBottom: "20px" }}>Tonight&apos;s Lineup</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {event.performers.map((p: any, i: number) => (
                  <div key={p.name} style={{ background: "white", borderRadius: "12px", padding: "20px", border: "1px solid rgba(14,12,10,0.08)", display: "flex", alignItems: "center", gap: "20px" }}>
                    <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: event.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", flexShrink: 0 }}>{p.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "#0E0C0A" }}>{p.name}</span>
                        {i === 0 && <span style={{ background: "#C8441A", color: "white", fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px" }}>HEADLINER</span>}
                      </div>
                      <div style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.55, marginBottom: "8px" }}>{p.genre}</div>
                      <div style={{ display: "flex", gap: "16px" }}>
                        <span style={{ fontSize: "13px", color: "#0E0C0A" }}>⭐ {p.rating}/5</span>
                        <span style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.5 }}>{p.shows} shows</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REVIEWS TAB */}
          {activeTab === "reviews" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "48px", fontWeight: 900, color: "#0E0C0A" }}>4.8</div>
                <div>
                  <div style={{ fontSize: "20px", marginBottom: "4px" }}>⭐⭐⭐⭐⭐</div>
                  <div style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.5 }}>Based on {event.reviews.length * 12} reviews</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {event.reviews.map((r: any) => (
                  <div key={r.name} style={{ background: "white", borderRadius: "12px", padding: "20px", border: "1px solid rgba(14,12,10,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#C8441A", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "14px" }}>{r.name[0]}</div>
                        <span style={{ fontWeight: 600, fontSize: "14px", color: "#0E0C0A" }}>{r.name}</span>
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

          {/* VENUE TAB */}
          {activeTab === "venue" && (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#0E0C0A", marginBottom: "20px" }}>Venue Details</h2>
              <div style={{ background: "white", borderRadius: "12px", padding: "24px", border: "1px solid rgba(14,12,10,0.08)", marginBottom: "16px" }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: 700, color: "#0E0C0A", marginBottom: "8px" }}>{event.venue}</div>
                <div style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.6, marginBottom: "16px" }}>📍 {event.address}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  {["Parking Available", "AC", "Accessible"].map(f => (
                    <div key={f} style={{ background: "#F7F3EE", borderRadius: "8px", padding: "10px", textAlign: "center", fontSize: "13px", color: "#0E0C0A" }}>✅ {f}</div>
                  ))}
                </div>
              </div>
              <div style={{ background: "#0E0C0A", borderRadius: "12px", height: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center", color: "white" }}>
                  <div style={{ fontSize: "48px", marginBottom: "8px" }}>🗺️</div>
                  <div style={{ fontSize: "14px", opacity: 0.6 }}>Map view coming soon</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — BOOKING PANEL */}
        <div style={{ position: "sticky", top: "80px", height: "fit-content" }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "24px", border: "1px solid rgba(14,12,10,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#0E0C0A", marginBottom: "4px" }}>
              {event.isFree ? "Free Entry" : `₹${event.price} / seat`}
            </div>
            <div style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.5, marginBottom: "24px" }}>
              {event.totalSeats - event.bookedSeats.length} seats available
            </div>

            {/* SEAT MAP */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#0E0C0A", marginBottom: "12px" }}>Select your seats (max 4)</div>
              <div style={{ background: "#0E0C0A", borderRadius: "8px", padding: "8px", marginBottom: "8px", textAlign: "center" }}>
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em" }}>STAGE</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${event.cols}, 1fr)`, gap: "4px", marginBottom: "12px" }}>
                {Array.from({ length: event.rows * event.cols }, (_, i) => i + 1).map(seat => {
                  const isBooked = event.bookedSeats.includes(seat)
                  const isSelected = selectedSeats.includes(seat)
                  return (
                    <button key={seat} onClick={() => toggleSeat(seat)} style={{ width: "100%", aspectRatio: "1", borderRadius: "4px", border: "none", background: isBooked ? "rgba(14,12,10,0.1)" : isSelected ? "#C8441A" : "#F7F3EE", cursor: isBooked ? "not-allowed" : "pointer", fontSize: "9px", color: isBooked ? "rgba(14,12,10,0.3)" : isSelected ? "white" : "#0E0C0A", fontWeight: 600, transition: "all 0.15s" }} title={`Seat ${seat}`}>
                      {seat}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: "#0E0C0A", opacity: 0.6 }}>
                <span>⬜ Available</span>
                <span style={{ color: "#C8441A" }}>🟥 Selected</span>
                <span>▪️ Booked</span>
              </div>
            </div>

            {/* SELECTED SEATS */}
            {selectedSeats.length > 0 && (
              <div style={{ background: "#FFF5F2", borderRadius: "8px", padding: "12px", marginBottom: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#C8441A", marginBottom: "6px" }}>Selected: Seats {selectedSeats.join(", ")}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#0E0C0A" }}>
                  <span>{selectedSeats.length} × ₹{event.price}</span>
                  <span style={{ fontWeight: 700 }}>₹{totalAmount}</span>
                </div>
              </div>
            )}

            {bookingConfirmed ? (
              <div style={{ background: "#F0FFF4", border: "1px solid #68D391", borderRadius: "10px", padding: "16px", textAlign: "center", marginBottom: "12px" }}>
                <div style={{ fontSize: "20px", marginBottom: "4px" }}>✅</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#276749" }}>Booking confirmed</div>
                <div style={{ fontSize: "12px", color: "#276749", opacity: 0.8 }}>Seats {selectedSeats.join(", ")} · ₹{totalAmount}</div>
              </div>
            ) : (
              <button
                onClick={handleBookClick}
                disabled={selectedSeats.length === 0}
                style={{ display: "block", width: "100%", background: selectedSeats.length > 0 ? "#C8441A" : "rgba(14,12,10,0.1)", color: selectedSeats.length > 0 ? "white" : "rgba(14,12,10,0.3)", padding: "16px", borderRadius: "10px", border: "none", fontSize: "15px", fontWeight: 700, textAlign: "center", cursor: selectedSeats.length > 0 ? "pointer" : "not-allowed", boxSizing: "border-box", marginBottom: "12px" }}
              >
                {selectedSeats.length > 0 ? `Book ${selectedSeats.length} Seat${selectedSeats.length > 1 ? "s" : ""} — ₹${totalAmount}` : "Select seats to book"}
              </button>
            )}

            <div style={{ fontSize: "12px", color: "#0E0C0A", opacity: 0.45, textAlign: "center" }}>
              🔒 Secure payment · Instant confirmation · PDF ticket
            </div>
          </div>
        </div>
      </div>

      <AuthPromptSheet
        open={showAuthSheet}
        onClose={() => setShowAuthSheet(false)}
        title="Sign in to complete your booking"
        subtitle={`${selectedSeats.length} seat${selectedSeats.length > 1 ? "s" : ""} · ₹${totalAmount}`}
        onSuccess={handleAuthSuccess}
        registerHref={`/register?next=/events/${event.id}`}
      />
    </main>
  )
}
