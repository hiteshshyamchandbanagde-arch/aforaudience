"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import SiteNav from "@/components/SiteNav"
import AuthPromptSheet from "@/components/AuthPromptSheet"
import AudienceChoiceVoting from "@/components/AudienceChoiceVoting"
import SeatPicker from "@/components/SeatPicker"
import { formatEventTimeRange, isNightEvent } from "@/lib/eventTime"
import { getAvailabilityStatus, AVAILABILITY_BADGE } from "@/lib/availability"
import { useLocale } from "@/lib/i18n/translate"
import { EVENT_TERMS_CHECKLIST, REFUND_POLICY_LINK } from "@/lib/event-terms"

interface Review {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  user: { name: string; displayName: string | null }
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
    user: { name: string; displayName: string | null }
  }
  reviews: Review[]
  // Reputation epic §4 - per-show Hype Score, live-computed server-side.
  // Null until the show has been over 2hrs AND has 5+ reviews - the
  // client just hides the badge when it's null, no eligibility logic here.
  hypeScore?: number | null
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
  termsChecklist?: string[]
  specialNotes?: string | null
  specialNotesStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'
  venue: { name: string; address: string; city: string; facilities: string[]; seatingMode?: 'GENERAL_ADMISSION' | 'NUMBERED' } | null
  organiser: { id: string; orgName: string } | null
  lineup: Performer[]
  ticketTiers: TicketTier[]
  isCompetitionShow?: boolean
  competitionPrizeFirst?: string | null
  competitionPrizeSecond?: string | null
  competitionPrizeThird?: string | null
  celebrities?: { id: string; name: string; photoUrl: string | null }[]
  panelists?: { id: string; name: string; bio: string | null; photoUrl: string | null }[]
}

const TYPE_META: Record<string, { emoji: string; color: string; label: string }> = {
  OPEN_MIC: { emoji: "🎤", color: "var(--afa-green-black)", label: "Open Mic" },
  STAND_UP: { emoji: "😂", color: "var(--afa-maroon-black)", label: "Stand Up" },
  POETRY: { emoji: "📜", color: "var(--afa-indigo-black)", label: "Poetry" },
  THEATER: { emoji: "🎩", color: "var(--afa-plum-black)", label: "Theater" },
  LINEUP: { emoji: "🌟", color: "var(--afa-brown-black)", label: "Lineup" },
}

// Same date+startTime instant-comparison pattern used by the booking
// guard (POST /api/bookings) and the events listing page's tab split.
function isPastEvent(e: { date: string; startTime: string }): boolean {
  const [h, m] = e.startTime.split(':').map(Number)
  const eventStart = new Date(e.date)
  eventStart.setHours(h, m, 0, 0)
  return eventStart.getTime() <= Date.now()
}

export default function EventDetailPage({ event, canReview }: { event: EventData | null; canReview: boolean }) {
  const { t: tr } = useLocale()
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

  // Audience-adjustable booking fee (28 Jul). Defaults to the platform's
  // configured fee (fetched once, since it rarely changes) but the person
  // can lower it - down to ₹0 - or raise it before booking. null while
  // loading; feeInput tracks the actual editable value once the default
  // arrives. Server re-validates whatever gets sent (see POST /api/bookings) -
  // this is UX responsiveness, not the enforcement boundary.
  const [defaultBookingFee, setDefaultBookingFee] = useState<number | null>(null)
  const [feeInput, setFeeInput] = useState<number>(0)
  // Admin-configurable band (29 Jul) the fee input is clamped to — was a
  // hardcoded ₹0–₹500 range before this, now comes from the same
  // endpoint as the default. Falls back to ₹0–₹500 while loading/on
  // fetch failure so the input still has sane bounds; the real gate is
  // still server-side in POST /api/bookings regardless of these values.
  const [minBookingFee, setMinBookingFee] = useState<number>(0)
  const [maxBookingFee, setMaxBookingFee] = useState<number>(500)
  useEffect(() => {
    fetch("/api/platform-settings/audience-fee")
      .then((res) => res.json())
      .then((data) => {
        setDefaultBookingFee(data.audienceBookingFeeRupees)
        setFeeInput(data.audienceBookingFeeRupees)
        setMinBookingFee(data.minAudienceBookingFeeRupees)
        setMaxBookingFee(data.maxAudienceBookingFeeRupees)
      })
      .catch(() => {
        setDefaultBookingFee(0)
        setFeeInput(0)
      })
  }, [])

  // Live-caught (28 Jul): browser back/forward navigation always serves
  // the Router Cache's snapshot of this page regardless of staleTimes
  // config - confirmed showing "212 of 212 seats" after 6 real seats had
  // already been CONFIRMED-booked against this exact event, only fixed
  // by a hard refresh. The seat picker below self-heals (it fetches
  // fresh from GET /api/events/[id]/seats on its own mount), but the
  // server-computed availableSeats/totalSeats header does not. A single
  // router.refresh() on mount busts the cache and re-renders the server
  // component with live data on every visit, however the user arrived.
  useEffect(() => {
    router.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        setBookingError(data.error || tr.eventDetailPage.plusOneRetryError)
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
          isNumbered
            ? { eventId: event.id, seatIds: selectedSeatIds, bookingFeeOverride: feeInput }
            : { eventId: event.id, seats: selectedSeats, bookingFeeOverride: feeInput }
        ),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.reason === "PHONE_NOT_VERIFIED") {
          router.push(`/verify-phone?next=${encodeURIComponent(`/events/${event.id}`)}`)
          return
        }
        throw new Error(data.error || tr.eventDetailPage.reserveFailed)
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
      setReviewError(tr.eventDetailPage.pickRatingFirst)
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
      if (!res.ok) throw new Error(data.error || tr.eventDetailPage.reviewFailed)
      setSubmittedReviews((prev) => ({ ...prev, [performanceId]: data }))
    } catch (err: any) {
      setReviewError(err.message)
    } finally {
      setReviewSubmitting(null)
    }
  }

  const handleBookClick = () => {
    if (totalSelected === 0) {
      setBookingError(tr.eventDetailPage.selectSeatFirst)
      return
    }
    if (!event) return
    // Feedback (31 Jul, Hitesh device test) - booking creation had no
    // check at all against the event's own date/time, so a past event
    // could be booked and paid for end-to-end. Server now rejects this
    // too (POST /api/bookings) - this is the client-side mirror so the
    // person gets a clear message instead of reaching a payment screen
    // for a show that's already over.
    if (isPastEvent(event)) {
      setBookingError(tr.eventDetailPage.eventAlreadyHappened)
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
      <main style={{ minHeight: "100vh", background: "var(--afa-cream)", fontFamily: "system-ui, sans-serif" }}>
        <SiteNav backHref="/events" backLabel={tr.nav.backToEvents} />
        <div style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px" }}>{tr.eventDetailPage.notFound}</div>
      </main>
    )
  }

  const meta = TYPE_META[event.type] || TYPE_META.OPEN_MIC
  const typeKey = (event.type in TYPE_META ? event.type : "OPEN_MIC") as keyof typeof tr.eventTypes
  const typeLabel = tr.eventTypes[typeKey]

  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-cream)", fontFamily: "system-ui, sans-serif" }}>
      <SiteNav backHref="/events" backLabel={tr.nav.backToEvents} />

      {/* HERO */}
      <div style={{ background: meta.color, padding: "64px 48px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: "48px", top: "50%", transform: "translateY(-50%)", fontSize: "160px", opacity: 0.15 }}>{meta.emoji}</div>
        <div style={{ maxWidth: "800px", position: "relative" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            <span style={{ background: "var(--afa-terracotta)", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: "4px", letterSpacing: "0.08em" }}>{typeLabel.toUpperCase()}</span>
            {event.vibe && <span style={{ background: "rgba(255,255,255,0.15)", color: "white", fontSize: "11px", padding: "4px 12px", borderRadius: "4px" }}>⚡ {event.vibe}</span>}
            {event.isFree ? (
              <span style={{ background: "var(--afa-green-mid)", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: "4px" }}>{tr.eventsPage.freeBadge}</span>
            ) : (
              <span style={{ background: "rgba(201,151,58,0.9)", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: "4px" }}>
                {event.ticketPrice ? tr.eventDetailPage.pricePerSeat.replace("{price}", `₹${event.ticketPrice}`) : "—"}
              </span>
            )}
          </div>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 900, color: "white", lineHeight: 1.05, marginBottom: "20px", letterSpacing: "-1px" }}>
            {event.title}
          </h1>
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
            {[
              { icon: "📅", text: new Date(event.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) },
              { icon: isNightEvent(event.startTime) ? "🌙" : "🕐", text: formatEventTimeRange(event.startTime, event.endTime) },
              { icon: "📍", text: event.venue ? `${event.venue.name}, ${event.venue.city}` : tr.eventsPage.venueTBD },
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
                style={{ padding: "12px 24px", border: "none", background: "transparent", fontSize: "14px", fontWeight: 600, color: activeTab === tab ? "var(--afa-terracotta)" : "var(--afa-ink)", cursor: "pointer", borderBottom: `2px solid ${activeTab === tab ? "var(--afa-terracotta)" : "transparent"}`, marginBottom: "-2px", textTransform: "capitalize" }}
              >
                {tab === "overview" ? tr.eventDetailPage.tabOverview : tab === "lineup" ? tr.eventDetailPage.tabLineup : tr.eventDetailPage.tabVenue}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "12px" }}>{tr.eventDetailPage.aboutEvent}</h2>
              <p style={{ fontSize: "15px", lineHeight: 1.8, color: "var(--afa-ink)", opacity: 0.75, marginBottom: "16px" }}>{event.description}</p>
              {event.organiser && (
                <p style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.6, marginBottom: "32px" }}>
                  {tr.eventDetailPage.organisedBy}{" "}
                  <Link href={`/organisers/${event.organiser.id}`} style={{ color: "var(--afa-terracotta)", fontWeight: 600, textDecoration: "none" }}>
                    {event.organiser.orgName}
                  </Link>
                </p>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "32px" }}>
                {[
                  { label: tr.eventDetailPage.dressCode, value: event.dresscode, icon: "👔" },
                  { label: tr.eventDetailPage.vibeLabel, value: event.vibe, icon: "⚡" },
                  { label: tr.eventDetailPage.surpriseAct, value: event.surpriseAct ? tr.eventDetailPage.yes : tr.eventDetailPage.no, icon: "🎁" },
                  { label: tr.eventDetailPage.totalSeatsLabel, value: String(event.totalSeats), icon: "💺" },
                ].filter((i) => i.value).map((item) => (
                  <div key={item.label} style={{ background: "white", borderRadius: "10px", padding: "16px", border: "1px solid rgba(14,12,10,0.08)" }}>
                    <div style={{ fontSize: "20px", marginBottom: "6px" }}>{item.icon}</div>
                    <div style={{ fontSize: "11px", color: "var(--afa-ink)", opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>{item.label}</div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--afa-ink)" }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* FEAT-2608-045 - checklist items the organiser selected at
                  creation, AFA's platform-wide refund/cancellation policy
                  (linked, not duplicated - see event-terms.ts), and the
                  organiser's free-text special note ONLY once admin-
                  approved. A PENDING/REJECTED note is never shown here -
                  same principle as the Feedback table never exposing
                  unreviewed content publicly. */}
              {((event.termsChecklist && event.termsChecklist.length > 0) || (event.specialNotesStatus === 'APPROVED' && event.specialNotes)) && (
                <div style={{ marginBottom: "32px" }}>
                  <h3 style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "12px" }}>
                    {tr.eventDetailPage.eventTermsHeading}
                  </h3>
                  {event.termsChecklist && event.termsChecklist.length > 0 && (
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px", marginBottom: event.specialNotesStatus === 'APPROVED' && event.specialNotes ? "16px" : 0 }}>
                      {EVENT_TERMS_CHECKLIST.filter((t) => event.termsChecklist!.includes(t.key)).map((t) => (
                        <li key={t.key} style={{ fontSize: "14px", color: "var(--afa-ink)", opacity: 0.8, display: "flex", gap: "8px" }}>
                          <span style={{ color: "var(--afa-terracotta)" }}>•</span>
                          {tr.eventTermsChecklist[t.key as keyof typeof tr.eventTermsChecklist] || t.label}
                        </li>
                      ))}
                    </ul>
                  )}
                  {event.specialNotesStatus === 'APPROVED' && event.specialNotes && (
                    <div style={{ background: "white", borderRadius: "10px", padding: "14px 16px", border: "1px solid rgba(14,12,10,0.08)" }}>
                      <div style={{ fontSize: "11px", color: "var(--afa-ink)", opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>{tr.eventDetailPage.specialNoteLabel}</div>
                      <div style={{ fontSize: "14px", color: "var(--afa-ink)", lineHeight: 1.6 }}>{event.specialNotes}</div>
                    </div>
                  )}
                  <p style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.55, marginTop: "12px" }}>
                    {tr.eventDetailPage.refundPolicyLinkText.split("{link}")[0]}
                    <Link href={REFUND_POLICY_LINK} target="_blank" style={{ color: "var(--afa-terracotta)", fontWeight: 600 }}>{tr.eventDetailPage.refundPolicyLinkLabel}</Link>
                    {tr.eventDetailPage.refundPolicyLinkText.split("{link}")[1]}
                  </p>
                </div>
              )}

              {event.isCompetitionShow && (
                <div style={{ marginBottom: "32px" }}>
                  <h3 style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "16px" }}>
                    {tr.eventDetailPage.competitionShow}
                  </h3>

                  {(event.competitionPrizeFirst || event.competitionPrizeSecond || event.competitionPrizeThird) && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "20px" }}>
                      {[
                        { rank: tr.eventDetailPage.firstPrize, value: event.competitionPrizeFirst },
                        { rank: tr.eventDetailPage.secondPrize, value: event.competitionPrizeSecond },
                        { rank: tr.eventDetailPage.thirdPrize, value: event.competitionPrizeThird },
                      ].filter((p) => p.value).map((p) => (
                        <div key={p.rank} style={{ background: "white", borderRadius: "10px", padding: "16px", border: "1px solid rgba(200,68,26,0.15)" }}>
                          <div style={{ fontSize: "11px", color: "var(--afa-terracotta)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>{p.rank}</div>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--afa-ink)" }}>{p.value}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {event.celebrities && event.celebrities.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                      {event.celebrities.map((c) => (
                        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "14px", background: "white", borderRadius: "10px", padding: "16px", border: "1px solid rgba(14,12,10,0.08)" }}>
                          {c.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.photoUrl} alt={c.name} style={{ width: "56px", height: "56px", borderRadius: "50%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "var(--afa-cream)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>⭐</div>
                          )}
                          <div>
                            <div style={{ fontSize: "11px", color: "var(--afa-ink)", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>{tr.eventDetailPage.celebrityAttending}</div>
                            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--afa-ink)" }}>{c.name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {event.panelists && event.panelists.length > 0 && (
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--afa-ink)", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>{tr.eventDetailPage.panelists}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                        {event.panelists.map((p) => (
                          <div key={p.id} style={{ display: "flex", gap: "12px", background: "white", borderRadius: "10px", padding: "14px", border: "1px solid rgba(14,12,10,0.08)" }}>
                            {p.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.photoUrl} alt={p.name} style={{ width: "44px", height: "44px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: "44px", height: "44px", borderRadius: "8px", background: "var(--afa-cream)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>🎙️</div>
                            )}
                            <div>
                              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--afa-ink)" }}>{p.name}</div>
                              {p.bio && <div style={{ fontSize: "12px", color: "var(--afa-ink)", opacity: 0.6, marginTop: "2px" }}>{p.bio}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <AudienceChoiceVoting eventId={event.id} isCompetitionShow={event.isCompetitionShow} />
                </div>
              )}
            </div>
          )}

          {activeTab === "lineup" && (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "20px" }}>{tr.eventDetailPage.lineupHeading}</h2>
              {event.lineup.length === 0 ? (
                <p style={{ fontSize: "14px", color: "var(--afa-ink)", opacity: 0.5 }}>{tr.eventDetailPage.lineupNotConfirmed}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {event.lineup.map((p) => {
                    const performerName = p.artist.user.displayName || p.artist.user.name
                    return (
                    <div key={p.id} style={{ background: "white", borderRadius: "12px", padding: "20px", border: "1px solid rgba(14,12,10,0.08)", display: "flex", alignItems: "center", gap: "20px" }}>
                      <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: meta.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: 700, color: "white", flexShrink: 0 }}>
                        {performerName.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <div style={{ fontWeight: 700, fontSize: "16px", color: "var(--afa-ink)" }}>{performerName}</div>
                          {p.hypeScore != null && (
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--afa-terracotta)", background: "rgba(200,68,26,0.1)", padding: "2px 8px", borderRadius: "999px" }}>
                              🔥 {p.hypeScore.toFixed(1)}
                            </span>
                          )}
                        </div>
                        {p.artist.genre.length > 0 && (
                          <div style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.55, marginBottom: "8px" }}>{p.artist.genre.join(", ")}</div>
                        )}
                        <div style={{ display: "flex", gap: "16px" }}>
                          <span style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.5 }}>{tr.eventDetailPage.slotDuration.replace("{n}", String(p.slot)).replace("{duration}", String(p.duration))}</span>
                        </div>

                        {event.plusOnesRequired > 0 && plusOneStatus[p.id] && (
                          <div style={{ marginTop: "10px" }}>
                            {plusOneStatus[p.id].alreadyConfirmed ? (
                              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--afa-green-bright)", background: "var(--afa-success-bg)", padding: "5px 12px", borderRadius: "999px" }}>
                                {tr.eventDetailPage.plusOneConfirmedAs.replace("{name}", performerName.split(" ")[0])}
                              </span>
                            ) : plusOneStatus[p.id].fulfilled ? (
                              <span style={{ fontSize: "12px", color: "var(--afa-ink)", opacity: 0.5 }}>
                                {tr.eventDetailPage.plusOneFullySupported.replace("{confirmed}", String(plusOneStatus[p.id].confirmedCount)).replace("{required}", String(plusOneStatus[p.id].required))}
                              </span>
                            ) : (
                              <button
                                onClick={() => confirmPlusOne(p.id)}
                                disabled={plusOneBusy === p.id}
                                style={{
                                  fontSize: "12px", fontWeight: 600, padding: "6px 14px", borderRadius: "999px",
                                  border: "1.5px solid var(--afa-terracotta)", background: "transparent", color: "var(--afa-terracotta)",
                                  cursor: plusOneBusy === p.id ? "default" : "pointer",
                                  opacity: plusOneBusy === p.id ? 0.6 : 1,
                                }}
                              >
                                {plusOneBusy === p.id
                                  ? tr.eventDetailPage.plusOneConfirming
                                  : tr.eventDetailPage.plusOneIllBeThere.replace("{name}", performerName.split(" ")[0]).replace("{confirmed}", String(plusOneStatus[p.id].confirmedCount)).replace("{required}", String(plusOneStatus[p.id].required))}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Existing reviews */}
                        {(p.reviews.length > 0 || submittedReviews[p.id]) && (
                          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                            {submittedReviews[p.id] && !p.reviews.find((r) => r.id === submittedReviews[p.id].id) && (
                              <div style={{ fontSize: "13px", color: "var(--afa-ink)" }}>
                                {"⭐".repeat(submittedReviews[p.id].rating)} <span style={{ opacity: 0.6 }}>— {tr.eventDetailPage.reviewYouSuffix}</span>
                                {submittedReviews[p.id].comment && <span style={{ opacity: 0.7 }}> · {submittedReviews[p.id].comment}</span>}
                              </div>
                            )}
                            {p.reviews.slice(0, 3).map((r) => (
                              <div key={r.id}>
                                <div style={{ fontSize: "13px", color: "var(--afa-ink)" }}>
                                  {"⭐".repeat(r.rating)} <span style={{ opacity: 0.6 }}>— {r.user.displayName || r.user.name}</span>
                                  {r.comment && <span style={{ opacity: 0.7 }}> · {r.comment}</span>}
                                </div>
                                {r.reply && (
                                  <div style={{ fontSize: "12px", color: "var(--afa-ink)", opacity: 0.75, marginTop: "3px", marginLeft: "16px", paddingLeft: "10px", borderLeft: "2px solid rgba(200,68,26,0.3)" }}>
                                    <strong>{r.reply.author.displayName || r.reply.author.name}</strong> {tr.eventDetailPage.repliedLabel} {r.reply.text}
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
                                  style={{ marginLeft: "8px", fontSize: "12px", fontWeight: 600, color: "var(--afa-cream)", background: "var(--afa-terracotta)", border: "none", borderRadius: "6px", padding: "4px 12px", cursor: "pointer", opacity: reviewSubmitting === p.id ? 0.6 : 1 }}
                                >
                                  {reviewSubmitting === p.id ? tr.eventDetailPage.ratingSubmitting : tr.eventDetailPage.ratePrompt}
                                </button>
                              )}
                            </div>
                            {reviewDrafts[p.id]?.rating > 0 && (
                              <input
                                type="text"
                                placeholder={tr.eventDetailPage.commentPlaceholder}
                                value={reviewDrafts[p.id]?.comment || ""}
                                onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [p.id]: { rating: prev[p.id]?.rating || 0, comment: e.target.value } }))}
                                style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(14,12,10,0.15)", fontSize: "13px", boxSizing: "border-box" }}
                              />
                            )}
                            {reviewError && <p style={{ fontSize: "12px", color: "var(--afa-error)", marginTop: "6px" }}>{reviewError}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "venue" && (
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "20px" }}>{tr.eventDetailPage.venueDetailsHeading}</h2>
              {event.venue ? (
                <div style={{ background: "white", borderRadius: "12px", padding: "24px", border: "1px solid rgba(14,12,10,0.08)" }}>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "8px" }}>{event.venue.name}</div>
                  <div style={{ fontSize: "14px", color: "var(--afa-ink)", opacity: 0.6, marginBottom: "16px" }}>📍 {event.venue.address}, {event.venue.city}</div>
                  {event.venue.facilities.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px" }}>
                      {event.venue.facilities.map((f) => (
                        <div key={f} style={{ background: "var(--afa-cream)", borderRadius: "8px", padding: "10px", textAlign: "center", fontSize: "13px", color: "var(--afa-ink)" }}>✅ {f}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: "14px", color: "var(--afa-ink)", opacity: 0.5 }}>{tr.eventDetailPage.venueNotConfirmed}</p>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — INFO PANEL */}
        <div style={{ position: "sticky", top: "80px", height: "fit-content" }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "24px", border: "1px solid rgba(14,12,10,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
            {isPastEvent(event) ? (
              <div>
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>🎭</div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "8px" }}>
                  {tr.eventDetailPage.eventEnded}
                </div>
                <p style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.6, lineHeight: 1.6 }}>
                  {tr.eventDetailPage.browseUpcoming}
                </p>
              </div>
            ) : reservedMessage ? (
              <div>
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>✅</div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "8px" }}>
                  {tr.eventDetailPage.seatsReserved}
                </div>
                <p style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.7, lineHeight: 1.6 }}>{reservedMessage}</p>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "4px" }}>
                  {event.isFree ? tr.eventDetailPage.freeEntry : event.ticketTiers.length > 0 ? tr.eventDetailPage.chooseSection : event.ticketPrice ? `₹${event.ticketPrice} / ${tr.eventDetailPage.seatSingular}` : tr.eventDetailPage.priceTBD}
                </div>
                <div style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.5, marginBottom: "10px" }}>
                  {tr.eventDetailPage.seatsAvailableSummary.replace("{available}", String(event.availableSeats)).replace("{total}", String(event.totalSeats)).replace("{max}", String(event.maxSeatsPerBooking))}
                </div>
                {(() => {
                  const status = getAvailabilityStatus(event.totalSeats, event.availableSeats)
                  const badge = AVAILABILITY_BADGE[status]
                  const statusLabel = tr.availability[status]
                  return (
                    <div style={{ marginBottom: "16px" }}>
                      <span style={{ background: badge.bg, color: badge.color, fontSize: "12px", fontWeight: 700, padding: "5px 12px", borderRadius: "999px" }}>
                        {status === 'filling-fast' ? `🔥 ${statusLabel}` : statusLabel}
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
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--afa-ink)" }}>{t.sectionName}</div>
                            <div style={{ fontSize: "11px", color: "var(--afa-ink)", opacity: 0.5 }}>₹{t.price}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <button onClick={() => updateSeat(t.sectionName, -1, t.totalSeats)} style={{ width: "26px", height: "26px", padding: 0, borderRadius: "6px", border: "1px solid rgba(14,12,10,0.2)", background: "var(--afa-white)", cursor: "pointer" }}>−</button>
                            <span style={{ minWidth: "14px", textAlign: "center", fontSize: "13px" }}>{selectedSeats[t.sectionName] || 0}</span>
                            <button onClick={() => updateSeat(t.sectionName, 1, t.totalSeats)} style={{ width: "26px", height: "26px", padding: 0, borderRadius: "6px", border: "1px solid rgba(14,12,10,0.2)", background: "var(--afa-white)", cursor: "pointer" }}>+</button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--afa-ink)" }}>{tr.eventDetailPage.generalAdmission}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <button onClick={() => updateSeat('General', -1, event.totalSeats)} style={{ width: "26px", height: "26px", padding: 0, borderRadius: "6px", border: "1px solid rgba(14,12,10,0.2)", background: "var(--afa-white)", cursor: "pointer" }}>−</button>
                          <span style={{ minWidth: "14px", textAlign: "center", fontSize: "13px" }}>{selectedSeats['General'] || 0}</span>
                          <button onClick={() => updateSeat('General', 1, event.totalSeats)} style={{ width: "26px", height: "26px", padding: 0, borderRadius: "6px", border: "1px solid rgba(14,12,10,0.2)", background: "var(--afa-white)", cursor: "pointer" }}>+</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {event.isFree && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", marginBottom: "8px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--afa-ink)" }}>{tr.eventDetailPage.seatsLabel}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button onClick={() => updateSeat('General', -1, event.totalSeats)} style={{ width: "26px", height: "26px", padding: 0, borderRadius: "6px", border: "1px solid rgba(14,12,10,0.2)", background: "var(--afa-white)", cursor: "pointer" }}>−</button>
                      <span style={{ minWidth: "14px", textAlign: "center", fontSize: "13px" }}>{selectedSeats['General'] || 0}</span>
                      <button onClick={() => updateSeat('General', 1, event.totalSeats)} style={{ width: "26px", height: "26px", padding: 0, borderRadius: "6px", border: "1px solid rgba(14,12,10,0.2)", background: "var(--afa-white)", cursor: "pointer" }}>+</button>
                    </div>
                  </div>
                )}

                {bookingError && (
                  <div style={{ fontSize: "12px", color: "var(--afa-error)", marginBottom: "12px" }}>{bookingError}</div>
                )}

                {totalAmount > 0 ? (
                  <div style={{ marginBottom: "16px", paddingTop: "12px", borderTop: "1px solid rgba(14,12,10,0.08)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ fontSize: "12px", color: "var(--afa-ink)", opacity: 0.6 }}>{totalSelected} {totalSelected === 1 ? tr.eventDetailPage.seatSingular : tr.eventDetailPage.seatPlural}</span>
                      <span style={{ fontSize: "14px", color: "var(--afa-ink)" }}>₹{totalAmount.toLocaleString("en-IN")}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", gap: "12px" }}>
                      <div>
                        <div style={{ fontSize: "12px", color: "var(--afa-ink)", opacity: 0.6 }}>{tr.eventDetailPage.bookingFeeLabel}</div>
                        <div style={{ fontSize: "10px", color: "var(--afa-ink)", opacity: 0.45, maxWidth: "160px" }}>{tr.eventDetailPage.bookingFeeHint}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                        <span style={{ fontSize: "14px", color: "var(--afa-ink)" }}>₹</span>
                        <input
                          type="number"
                          min={minBookingFee}
                          max={maxBookingFee}
                          step={1}
                          value={feeInput}
                          disabled={defaultBookingFee === null}
                          onChange={(e) => {
                            const n = Number(e.target.value)
                            if (!Number.isFinite(n)) return
                            setFeeInput(Math.max(minBookingFee, Math.min(Math.round(n), maxBookingFee)))
                          }}
                          style={{ width: "64px", padding: "6px 8px", borderRadius: "6px", border: "1px solid rgba(14,12,10,0.2)", fontSize: "14px", textAlign: "right" }}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", borderTop: "1px solid rgba(14,12,10,0.08)" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--afa-ink)" }}>{tr.eventDetailPage.totalLabel}</span>
                      <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--afa-ink)" }}>₹{(totalAmount + feeInput).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingTop: "12px", borderTop: "1px solid rgba(14,12,10,0.08)" }}>
                    <span style={{ fontSize: "12px", color: "var(--afa-ink)", opacity: 0.6 }}>{totalSelected} {totalSelected === 1 ? tr.eventDetailPage.seatSingular : tr.eventDetailPage.seatPlural}</span>
                    <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--afa-ink)" }}>{tr.eventDetailPage.freeAmount}</span>
                  </div>
                )}

                <button
                  onClick={handleBookClick}
                  disabled={reserving || status === "loading"}
                  style={{ display: "block", width: "100%", background: "var(--afa-terracotta)", color: "white", padding: "16px", borderRadius: "10px", border: "none", fontSize: "15px", fontWeight: 700, textAlign: "center", boxSizing: "border-box", marginBottom: "12px", cursor: reserving || status === "loading" ? "default" : "pointer", opacity: reserving || status === "loading" ? 0.7 : 1 }}
                >
                  {reserving
                    ? tr.eventDetailPage.reserving
                    : status === "loading"
                    ? tr.eventDetailPage.loadingButton
                    : event.isFree
                    ? tr.eventDetailPage.confirmFreeBooking
                    : tr.eventDetailPage.continueToCheckout}
                </button>

                <div style={{ fontSize: "12px", color: "var(--afa-ink)", opacity: 0.45, textAlign: "center" }}>
                  {event.isFree
                    ? tr.eventDetailPage.freeEntryFooter
                    : tr.eventDetailPage.securePaymentFooter}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <AuthPromptSheet
        open={showAuthSheet}
        onClose={() => setShowAuthSheet(false)}
        title={tr.eventDetailPage.signInToReserve}
        subtitle={`${totalSelected} ${totalSelected === 1 ? tr.eventDetailPage.seatSingular : tr.eventDetailPage.seatPlural}${totalAmount > 0 ? ` · ₹${(totalAmount + feeInput).toLocaleString("en-IN")}` : ""}`}
        onSuccess={() => {
          setShowAuthSheet(false)
          reserveSeats()
        }}
      />

      <AuthPromptSheet
        open={reviewAuthTarget !== null}
        onClose={() => setReviewAuthTarget(null)}
        title={tr.eventDetailPage.signInToReview}
        onSuccess={() => {
          const target = reviewAuthTarget
          setReviewAuthTarget(null)
          if (target) submitReview(target)
        }}
      />

      <AuthPromptSheet
        open={plusOneAuthTarget !== null}
        onClose={() => setPlusOneAuthTarget(null)}
        title={tr.eventDetailPage.signInToConfirmPlusOne}
        onSuccess={() => {
          const target = plusOneAuthTarget
          setPlusOneAuthTarget(null)
          if (target) confirmPlusOne(target)
        }}
      />
    </main>
  )
}
