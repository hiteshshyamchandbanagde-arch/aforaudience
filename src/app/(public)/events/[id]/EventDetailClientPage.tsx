"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import SiteNav from "@/components/SiteNav"
import AuthPromptSheet from "@/components/AuthPromptSheet"
import SeatPicker from "@/components/SeatPicker"
import { formatEventTimeRange } from "@/lib/eventTime"
import { getAvailabilityStatus, AVAILABILITY_BADGE } from "@/lib/availability"

interface Review {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  user: { name: string }
  reply: { text: string; author: { name: string; displayName: string | null } } | null
}

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
  reviews: Review[]
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
  plusOnesRequired: number
  venue: { name: string; address: string; city: string; facilities: string[]; seatingMode?: 'GENERAL_ADMISSION' | 'NUMBERED' } | null
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

export default function EventDetailPage({ event, canReview }: { event: EventData | null; canReview: boolean }) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [activeTab, setActiveTab] = useState<"overview" | "lineup" | "venue">("overview")
  const [selectedSeats, setSelectedSeats] = useState<Record<string, number>>({})
  const isNumbered = event?.venue?.seatingMode === 'NUMBERED'
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([])
  const [numberedAmount, setNumberedAmount] = useState(0)
  const [showAuthSheet, setShowAuthSheet] = useState(false)
  const [reserving, setReserving] = useState(false)
  const [reservedMessage, setReservedMessage] = useState("")
  const [bookingError, setBookingError] = useState("")
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { rating: number; comment: string }>>({})
  const [reviewSubmitting, setReviewSubmitting] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState("")
  const [submittedReviews, setSubmittedReviews] = useState<Record<string, Review>>({})
  const [reviewAuthTarget, setReviewAuthTarget] = useState<string | null>(null)
  const [plusOneStatus, setPlusOneStatus] = useState<Record<string, { required: number; confirmedCount: number; alreadyConfirmed: boolean; fulfilled: boolean }>>({})
  const [plusOneBusy, setPlusOneBusy] = useState<string | null>(null)
  const [plusOneAuthTarget, setPlusOneAuthTarget] = useState<string | null>(null)

  useEffect(() => {
    if (!event || event.plusOnesRequired === 0) return
    event.lineup.forEach((p) => {
      fetch(`/api/performances/${p.id}/plus-ones`)
        .then((res) => res.json())
        .then((data) => setPlusOneStatus((prev) => ({ ...prev, [p.id]: data })))
        .catch(() => {})
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id])

  const confirmPlusOne = async (performanceId: string) => {
    if (status !== "authenticated") {
      setPlusOneAuthTarget(performanceId)
      return
    }
    setPlusOneBusy(performanceId)
    try {
      const res = await fetch(`/api/performances/${performanceId}/plus-ones`, { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setPlusOneStatus((prev) => ({ ...prev, [performanceId]: data }))
      } else {
        setBookingError(data.error || "Couldn't confirm right now - please try again")
      }
    } finally {
      setPlusOneBusy(null)
    }
  }

  const totalSelected = isNumbered ? selectedSeatIds.length : Object.values(selectedSeats).reduce((sum, q) => sum + q, 0)
  const totalAmount = isNumbered
    ? numberedAmount
    : event
    ? event.ticketTiers.length > 0
      ? event.ticketTiers.reduce((sum, t) => sum + (selectedSeats[t.sectionName] || 0) * t.price, 0)
      : (selectedSeats['General'] || 0) * (event.ticketPrice || 0)
    : 0

  const updateSeat = (section: string, delta: number, max: number) => {
    setBookingError("")
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
        body: JSON.stringify(
          isNumbered ? { eventId: event.id, seatIds: selectedSeatIds } : { eventId: event.id, seats: selectedSeats }
        ),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.reason === "PHONE_NOT_VERIFIED") {
          router.push(`/verify-phone?next=${encodeURIComponent(`/events/${event.id}`)}`)
          return
        }
        throw new Error(data.error || "Failed to reserve seats")
      }

      // Two possible responses:
      //   - payment is attached → Razorpay was configured; go to checkout
      //   - no payment (message only) → this env doesn't have Razorpay
      //     yet, so keep the Checkpoint 1 "reserved, we'll email you"
      //     behavior right here on this page.
      if (data.payment && data.booking) {
        router.push(`/checkout/${data.booking.id}`)
        return
      }
      setReservedMessage(data.message)
    } catch (err: any) {
      setBookingError(err.message)
    } finally {
      setReserving(false)
    }
  }

  const submitReview = async (performanceId: string) => {
    if (!event) return
    const draft = reviewDrafts[performanceId]
    if (!draft?.rating) {
      setReviewError("Pick a rating first")
      return
    }
    if (status === "loading") {
      return
    }
    if (status !== "authenticated") {
      setReviewAuthTarget(performanceId)
      return
    }
    setReviewSubmitting(performanceId)
    setReviewError("")
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, performanceId, rating: draft.rating, comment: draft.comment }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to submit review")
      setSubmittedReviews((prev) => ({ ...prev, [performanceId]: data }))
    } catch (err: any) {
      setReviewError(err.message)
    } finally {
      setReviewSubmitting(null)
    }
  }

  const handleBookClick = () => {
    if (totalSelected === 0) {
      setBookingError("Select at least one seat first")
      return
    }
    if (status === "loading") {
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
              { icon: "🕐", text: formatEventTimeRange(event.startTime, event.endTime) },
              { icon: "📍", text: event.venue ? `${event.venue.name}, ${event.venue.city}` : "Venue TBD" },
            ].map((item) => (
              <div key={item.text} style={{ display: "flex", alignItems: "center", gap: "6px", color: "rgba(255,255,255,0.8)", fontSize: "14px" }}>
                <span>{item.icon}</span><span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .event-detail-grid { grid-template-columns: 1fr 380px; }
        @media (max-width: 900px) {
          .event-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div className="event-detail-grid" style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px", display: "grid", gap: "32px" }}>
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

                        {event.plusOnesRequired > 0 && plusOneStatus[p.id] && (
                          <div style={{ marginTop: "10px" }}>
                            {plusOneStatus[p.id].alreadyConfirmed ? (
                              <span style={{ fontSize: "12px", fontWeight: 600, color: "#2F7D4A", background: "#F0FFF4", padding: "5px 12px", borderRadius: "999px" }}>
                                ✓ You're confirmed as {p.artist.user.name.split(" ")[0]}'s +1
                              </span>
                            ) : plusOneStatus[p.id].fulfilled ? (
                              <span style={{ fontSize: "12px", color: "#0E0C0A", opacity: 0.5 }}>
                                ✓ Fully supported ({plusOneStatus[p.id].confirmedCount}/{plusOneStatus[p.id].required})
                              </span>
                            ) : (
                              <button
                                onClick={() => confirmPlusOne(p.id)}
                                disabled={plusOneBusy === p.id}
                                style={{
                                  fontSize: "12px", fontWeight: 600, padding: "6px 14px", borderRadius: "999px",
                                  border: "1.5px solid #C8441A", background: "transparent", color: "#C8441A",
                                  cursor: plusOneBusy === p.id ? "default" : "pointer",
                                  opacity: plusOneBusy === p.id ? 0.6 : 1,
                                }}
                              >
                                {plusOneBusy === p.id
                                  ? "Confirming..."
                                  : `I'll be there for ${p.artist.user.name.split(" ")[0]} (${plusOneStatus[p.id].confirmedCount}/${plusOneStatus[p.id].required})`}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Existing reviews */}
                        {(p.reviews.length > 0 || submittedReviews[p.id]) && (
                          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                            {submittedReviews[p.id] && !p.reviews.find((r) => r.id === submittedReviews[p.id].id) && (
                              <div style={{ fontSize: "13px", color: "#0E0C0A" }}>
                                {"⭐".repeat(submittedReviews[p.id].rating)} <span style={{ opacity: 0.6 }}>— you</span>
                                {submittedReviews[p.id].comment && <span style={{ opacity: 0.7 }}> · {submittedReviews[p.id].comment}</span>}
                              </div>
                            )}
                            {p.reviews.slice(0, 3).map((r) => (
                              <div key={r.id}>
                                <div style={{ fontSize: "13px", color: "#0E0C0A" }}>
                                  {"⭐".repeat(r.rating)} <span style={{ opacity: 0.6 }}>— {r.user.name}</span>
                                  {r.comment && <span style={{ opacity: 0.7 }}> · {r.comment}</span>}
                                </div>
                                {r.reply && (
                                  <div style={{ fontSize: "12px", color: "#0E0C0A", opacity: 0.75, marginTop: "3px", marginLeft: "16px", paddingLeft: "10px", borderLeft: "2px solid rgba(200,68,26,0.3)" }}>
                                    <strong>{r.reply.author.displayName || r.reply.author.name}</strong> replied: {r.reply.text}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Rate this performer — only shown to viewers the server has
                            confirmed have a checked-in booking for this event (canReview,
                            computed in the parent server component). Previously this
                            rendered unconditionally and let anyone fill it out only to
                            hit a 403 from POST /api/reviews on submit. */}
                        {canReview && !submittedReviews[p.id] && !p.reviews.some((r) => r.user.name === (session?.user as any)?.name) && (
                          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(14,12,10,0.06)" }}>
                            <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                  key={n}
                                  onClick={() => setReviewDrafts((prev) => ({ ...prev, [p.id]: { rating: n, comment: prev[p.id]?.comment || "" } }))}
                                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", padding: 0, opacity: (reviewDrafts[p.id]?.rating || 0) >= n ? 1 : 0.25 }}
                                >
                                  ⭐
                                </button>
                              ))}
                              {reviewDrafts[p.id]?.rating > 0 && (
                                <button
                                  onClick={() => submitReview(p.id)}
                                  disabled={reviewSubmitting === p.id}
                                  style={{ marginLeft: "8px", fontSize: "12px", fontWeight: 600, color: "#F7F3EE", background: "#C8441A", border: "none", borderRadius: "6px", padding: "4px 12px", cursor: "pointer", opacity: reviewSubmitting === p.id ? 0.6 : 1 }}
                                >
                                  {reviewSubmitting === p.id ? "Submitting..." : "Rate"}
                                </button>
                              )}
                            </div>
                            {reviewDrafts[p.id]?.rating > 0 && (
                              <input
                                type="text"
                                placeholder="Add a comment (optional)"
                                value={reviewDrafts[p.id]?.comment || ""}
                                onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [p.id]: { rating: prev[p.id]?.rating || 0, comment: e.target.value } }))}
                                style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(14,12,10,0.15)", fontSize: "13px", boxSizing: "border-box" }}
                              />
                            )}
                            {reviewError && <p style={{ fontSize: "12px", color: "#B3261E", marginTop: "6px" }}>{reviewError}</p>}
                          </div>
                        )}
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
                <div style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.5, marginBottom: "10px" }}>
                  {event.availableSeats} of {event.totalSeats} seats total · max {event.maxSeatsPerBooking} per booking
                </div>
                {(() => {
                  const status = getAvailabilityStatus(event.totalSeats, event.availableSeats)
                  const badge = AVAILABILITY_BADGE[status]
                  return (
                    <div style={{ marginBottom: "16px" }}>
                      <span style={{ background: badge.bg, color: badge.color, fontSize: "12px", fontWeight: 700, padding: "5px 12px", borderRadius: "999px" }}>
                        {status === 'filling-fast' ? `🔥 ${badge.label}` : badge.label}
                      </span>
                    </div>
                  )
                })()}

                {!event.isFree && isNumbered && (
                  <div style={{ marginBottom: '16px' }}>
                    <SeatPicker
                      eventId={event.id}
                      maxSeatsPerBooking={event.maxSeatsPerBooking}
                      selected={selectedSeatIds}
                      onChange={(ids, amount) => {
                        setBookingError("")
                        setSelectedSeatIds(ids)
                        setNumberedAmount(amount)
                      }}
                    />
                  </div>
                )}

                {!event.isFree && !isNumbered && (
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
                  disabled={reserving || status === "loading"}
                  style={{ display: "block", width: "100%", background: "#C8441A", color: "white", padding: "16px", borderRadius: "10px", border: "none", fontSize: "15px", fontWeight: 700, textAlign: "center", boxSizing: "border-box", marginBottom: "12px", cursor: reserving || status === "loading" ? "default" : "pointer", opacity: reserving || status === "loading" ? 0.7 : 1 }}
                >
                  {reserving
                    ? "Reserving..."
                    : status === "loading"
                    ? "Loading..."
                    : event.isFree
                    ? "Confirm Free Booking"
                    : "Continue to Checkout"}
                </button>

                <div style={{ fontSize: "12px", color: "#0E0C0A", opacity: 0.45, textAlign: "center" }}>
                  {event.isFree
                    ? "Free entry — we'll confirm your seat instantly."
                    : "Secure payment by Razorpay · UPI, card, netbanking"}
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

      <AuthPromptSheet
        open={reviewAuthTarget !== null}
        onClose={() => setReviewAuthTarget(null)}
        title="Sign in to leave a review"
        onSuccess={() => {
          const target = reviewAuthTarget
          setReviewAuthTarget(null)
          if (target) submitReview(target)
        }}
      />

      <AuthPromptSheet
        open={plusOneAuthTarget !== null}
        onClose={() => setPlusOneAuthTarget(null)}
        title="Sign in to confirm as a +1"
        onSuccess={() => {
          const target = plusOneAuthTarget
          setPlusOneAuthTarget(null)
          if (target) confirmPlusOne(target)
        }}
      />
    </main>
  )
}
