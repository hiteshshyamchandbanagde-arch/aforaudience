"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSession, getSession } from "next-auth/react"
import SiteNav from "@/components/SiteNav"
import AuthPromptSheet from "@/components/AuthPromptSheet"
import AudienceChoiceVoting from "@/components/AudienceChoiceVoting"
import SeatPicker from "@/components/SeatPicker"
import { EventPoster, EventTypeBadge, SeatStateDot } from "@/components/EventCard"
import { CalendarIcon, ClockIcon, PinIcon, TicketIcon, TrophyIcon, DressCodeIcon, VibeIcon, SurpriseIcon, AgeIcon } from "@/components/icons/EventIcons"
import { FacilityIcon } from "@/components/icons/VenueIcons"
import { formatEventTimeRange } from "@/lib/eventTime"
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
    user: { name: string; displayName: string | null; avatar?: string | null }
  }
  reviews: Review[]
  // Reputation epic §4 - per-show Hype Score, live-computed server-side.
  // Null until the show has been over 2hrs AND has 5+ reviews - the
  // client just hides the stat when it's null, no eligibility logic here.
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
  ageLimit?: string | null
  posterImage?: string | null
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

// Small eyebrow-style section label, matching the export's <Eyebrow>
// (bits.tsx) - amber mono uppercase, reused for every section heading
// below ("The fine print" / "The lineup" / "Competition Show" /
// "Venue facilities") instead of the old bigger serif <h2>/<h3> mix.
function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", color: "var(--afa-amber)" }}>
      {children}
    </span>
  )
}

function MetaTile({ icon: Icon, label, value }: { icon: (p: { style?: React.CSSProperties }) => React.ReactElement; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", borderTop: "1px solid rgba(245,245,240,0.1)", padding: "16px 0" }}>
      <Icon style={{ width: "20px", height: "20px", marginTop: "2px", flexShrink: 0, color: "var(--afa-amber)" }} />
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(245,245,240,0.4)" }}>{label}</div>
        <div style={{ marginTop: "4px", fontSize: "14px", color: "rgba(245,245,240,0.85)" }}>{value}</div>
      </div>
    </div>
  )
}

// Export's HypeStat (EventDetail.tsx) - a short amber progress bar + the
// raw number, not a fire emoji. Hype Score is 0-100-ish in practice
// (computeHypeScore averages 0-5-star ratings scaled up) - clamp defends
// the bar width against any future scale change without needing to
// touch this component again.
function HypeStat({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ width: "64px", height: "4px", borderRadius: "2px", overflow: "hidden", background: "rgba(245,245,240,0.1)" }}>
        <div style={{ height: "100%", borderRadius: "2px", background: "var(--afa-amber)", width: `${pct}%` }} />
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "rgba(245,245,240,0.6)" }}>{value.toFixed(1)}</span>
    </div>
  )
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

  const handleBookClick = async () => {
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
      // BUG-2608-055: useSession()'s client-side status can briefly read
      // "unauthenticated" right after a real login - on a cold serverless
      // function the hook can settle in that order (loading ->
      // unauthenticated -> authenticated) instead of going straight to
      // "authenticated". The Continue button was already enabled by then
      // (only "loading" disables it), so a click here used to be
      // misrouted straight to the sign-in sheet even for a genuinely
      // signed-in person - confirmed via CI: zero /api/bookings requests
      // ever fired in the failing runs.
      //
      // Guests really are unauthenticated and should see the sign-in
      // sheet, so we can't just widen the disabled condition without
      // breaking that intended flow. Instead, before trusting the
      // possibly-stale hook, ask the server directly - getSession() hits
      // /api/auth/session fresh, same source of truth the middleware and
      // API routes use, so it can't be behind the hook.
      const freshSession = await getSession()
      if (freshSession?.user) {
        // Genuinely already signed in - proceed as if status had been
        // "authenticated" all along.
      } else {
        setShowAuthSheet(true)
        return
      }
    }
    reserveSeats()
  }

  if (!event) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--afa-surface-page)", fontFamily: "var(--font-sans)" }}>
        <SiteNav backHref="/events" backLabel={tr.nav.backToEvents} />
        <div style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px", color: "var(--afa-text-primary)" }}>{tr.eventDetailPage.notFound}</div>
      </main>
    )
  }

  const typeKey = (event.type in tr.eventTypes ? event.type : "OPEN_MIC") as keyof typeof tr.eventTypes
  const typeLabel = tr.eventTypes[typeKey]
  const isPast = isPastEvent(event)

  // GEN-2608-077 - full rebuild against the approved Figma Make export
  // (EventDetail.tsx). The export is a single flowing scroll (hero ->
  // fine print -> lineup -> prizes -> facilities), not the old tabbed
  // Overview/Lineup/Venue layout - removed the tab switcher entirely
  // to match. The real content the tabs used to hold (description +
  // organiser link, event terms/refund policy/special note, competition
  // voting, reviews, plus-ones) is real functionality beyond the
  // export's own mockup scope, folded into the section it thematically
  // belongs to instead of dropped: description sits right under the
  // title (export's own `blurb` slot), terms/refund/special-note join
  // "The fine print" section, competition voting joins the prizes
  // section, venue name/address moved into the hero's when/where block
  // (matching the export exactly) with facilities as their own closing
  // section. The real interactive booking panel (seat/tier picker, fee
  // slider, Book button) replaces the export's static price+button box
  // in place - a real multi-state flow like that can't be a single
  // static button, so it lives inside the same bordered box the export
  // uses for its CTA, not as a separate sidebar.
  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-surface-page)", fontFamily: "var(--font-sans)" }}>
      <style>{`
        .afa-event-detail-container { max-width: 1152px; margin: 0 auto; padding: 40px 24px 112px; }
        @media (min-width: 640px) { .afa-event-detail-container { padding: 40px 32px 112px; } }
        .afa-event-hero-grid { display: grid; grid-template-columns: 1fr; gap: 32px; }
        @media (min-width: 1024px) { .afa-event-hero-grid { grid-template-columns: minmax(0, 0.9fr) 1.1fr; gap: 48px; } }
        .afa-event-hero-poster { position: relative; width: 100%; aspect-ratio: 3 / 4; overflow: hidden; border-radius: 3px; }
        @media (min-width: 1024px) { .afa-event-hero-poster-wrap { position: sticky; top: 32px; } }
        .afa-event-meta-grid { display: grid; grid-template-columns: 1fr; column-gap: 40px; }
        @media (min-width: 640px) { .afa-event-meta-grid { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1024px) { .afa-event-meta-grid { grid-template-columns: repeat(4, 1fr); } }
        .afa-event-lineup-row { display: flex; align-items: center; gap: 16px; padding: 16px 0; border-top: 1px solid rgba(245,245,240,0.1); }
        .afa-event-prize-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 640px) { .afa-event-prize-grid { grid-template-columns: repeat(3, 1fr); } }
        .afa-event-facility-grid { display: grid; grid-template-columns: 1fr; column-gap: 40px; }
        @media (min-width: 640px) { .afa-event-facility-grid { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1024px) { .afa-event-facility-grid { grid-template-columns: repeat(3, 1fr); } }
        .afa-book-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; background: var(--afa-fill-solid); color: var(--afa-on-fill-solid); padding: 14px; border-radius: 3px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: filter 0.2s ease; }
        .afa-book-btn:hover { filter: brightness(1.08); }
      `}</style>
      <SiteNav backHref="/events" backLabel={tr.nav.backToEvents} />

      <div className="afa-event-detail-container">
        {/* HERO: poster + title/meta/booking */}
        <div className="afa-event-hero-grid">
          <div className="afa-event-hero-poster-wrap">
            <div className="afa-event-hero-poster">
              <EventPoster posterImage={event.posterImage ?? null} title={event.title} type={event.type} typeLabel={typeLabel} />
            </div>
          </div>

          <div>
            <EventTypeBadge type={event.type} typeLabel={typeLabel} size={16} />
            <h1 style={{ marginTop: "16px", fontFamily: "var(--font-display)", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.05, color: "var(--afa-cream)" }}>
              {event.title}
            </h1>
            <p style={{ marginTop: "16px", maxWidth: "560px", fontSize: "15px", lineHeight: 1.7, color: "rgba(245,245,240,0.65)" }}>{event.description}</p>
            {event.organiser && (
              <p style={{ marginTop: "12px", fontSize: "13px", color: "rgba(245,245,240,0.5)" }}>
                {tr.eventDetailPage.organisedBy}{" "}
                <Link href={`/organisers/${event.organiser.id}`} style={{ color: "var(--afa-amber)", fontWeight: 600, textDecoration: "none" }}>
                  {event.organiser.orgName}
                </Link>
              </p>
            )}

            {/* when / where */}
            <div style={{ marginTop: "28px", display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid rgba(245,245,240,0.1)", paddingTop: "20px", fontSize: "14px", color: "rgba(245,245,240,0.8)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <CalendarIcon style={{ width: "18px", height: "18px", flexShrink: 0, color: "var(--afa-amber)" }} />
                <span>{new Date(event.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <ClockIcon style={{ width: "18px", height: "18px", flexShrink: 0, color: "var(--afa-amber)" }} />
                <span>{formatEventTimeRange(event.startTime, event.endTime)}</span>
              </div>
              {event.venue && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <PinIcon style={{ width: "18px", height: "18px", marginTop: "2px", flexShrink: 0, color: "var(--afa-amber)" }} />
                  <span>
                    <span style={{ color: "var(--afa-cream)" }}>{event.venue.name}</span>
                    <br />
                    <span style={{ color: "rgba(245,245,240,0.55)" }}>{event.venue.address}, {event.venue.city}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Booking - export's static price+CTA box, in place with the
                real interactive seat/tier picker + fee slider + Book
                button (a real multi-state flow, not a single button). */}
            <div style={{ marginTop: "28px", borderRadius: "3px", border: "1px solid rgba(245,245,240,0.1)", background: "var(--afa-surface-raised)", padding: "20px" }}>
              {isPast ? (
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", color: "var(--afa-cream)" }}>{tr.eventDetailPage.eventEnded}</div>
                  <p style={{ marginTop: "8px", fontSize: "13px", color: "rgba(245,245,240,0.55)", lineHeight: 1.6 }}>{tr.eventDetailPage.browseUpcoming}</p>
                </div>
              ) : reservedMessage ? (
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", color: "var(--afa-cream)" }}>{tr.eventDetailPage.seatsReserved}</div>
                  <p style={{ marginTop: "8px", fontSize: "13px", color: "rgba(245,245,240,0.6)", lineHeight: 1.6 }}>{reservedMessage}</p>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", marginBottom: "6px" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "22px", color: "var(--afa-cream)" }}>
                      {event.isFree ? tr.eventDetailPage.freeEntry : event.ticketTiers.length > 0 ? tr.eventDetailPage.chooseSection : event.ticketPrice ? `₹${event.ticketPrice} / ${tr.eventDetailPage.seatSingular}` : tr.eventDetailPage.priceTBD}
                    </span>
                    <SeatStateDot totalSeats={event.totalSeats} availableSeats={event.availableSeats} showCount />
                  </div>
                  <div style={{ fontSize: "12px", color: "rgba(245,245,240,0.4)", marginBottom: "16px" }}>
                    {tr.eventDetailPage.seatsAvailableSummary.replace("{available}", String(event.availableSeats)).replace("{total}", String(event.totalSeats)).replace("{max}", String(event.maxSeatsPerBooking))}
                  </div>

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
                          <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(245,245,240,0.08)" }}>
                            <div>
                              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--afa-cream)" }}>{t.sectionName}</div>
                              <div style={{ fontSize: "11px", color: "rgba(245,245,240,0.5)" }}>₹{t.price}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <button onClick={() => updateSeat(t.sectionName, -1, t.totalSeats)} style={{ width: "26px", height: "26px", padding: 0, borderRadius: "3px", border: "1px solid rgba(245,245,240,0.2)", background: "transparent", color: "var(--afa-cream)", cursor: "pointer" }}>−</button>
                              <span style={{ minWidth: "14px", textAlign: "center", fontSize: "13px", color: "var(--afa-cream)" }}>{selectedSeats[t.sectionName] || 0}</span>
                              <button onClick={() => updateSeat(t.sectionName, 1, t.totalSeats)} style={{ width: "26px", height: "26px", padding: 0, borderRadius: "3px", border: "1px solid rgba(245,245,240,0.2)", background: "transparent", color: "var(--afa-cream)", cursor: "pointer" }}>+</button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--afa-cream)" }}>{tr.eventDetailPage.generalAdmission}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <button onClick={() => updateSeat('General', -1, event.totalSeats)} style={{ width: "26px", height: "26px", padding: 0, borderRadius: "3px", border: "1px solid rgba(245,245,240,0.2)", background: "transparent", color: "var(--afa-cream)", cursor: "pointer" }}>−</button>
                            <span style={{ minWidth: "14px", textAlign: "center", fontSize: "13px", color: "var(--afa-cream)" }}>{selectedSeats['General'] || 0}</span>
                            <button onClick={() => updateSeat('General', 1, event.totalSeats)} style={{ width: "26px", height: "26px", padding: 0, borderRadius: "3px", border: "1px solid rgba(245,245,240,0.2)", background: "transparent", color: "var(--afa-cream)", cursor: "pointer" }}>+</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {event.isFree && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", marginBottom: "8px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--afa-cream)" }}>{tr.eventDetailPage.seatsLabel}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button onClick={() => updateSeat('General', -1, event.totalSeats)} style={{ width: "26px", height: "26px", padding: 0, borderRadius: "3px", border: "1px solid rgba(245,245,240,0.2)", background: "transparent", color: "var(--afa-cream)", cursor: "pointer" }}>−</button>
                        <span style={{ minWidth: "14px", textAlign: "center", fontSize: "13px", color: "var(--afa-cream)" }}>{selectedSeats['General'] || 0}</span>
                        <button onClick={() => updateSeat('General', 1, event.totalSeats)} style={{ width: "26px", height: "26px", padding: 0, borderRadius: "3px", border: "1px solid rgba(245,245,240,0.2)", background: "transparent", color: "var(--afa-cream)", cursor: "pointer" }}>+</button>
                      </div>
                    </div>
                  )}

                  {bookingError && (
                    <div style={{ fontSize: "12px", color: "var(--afa-error)", marginBottom: "12px" }}>{bookingError}</div>
                  )}

                  {totalAmount > 0 ? (
                    <div style={{ marginBottom: "16px", paddingTop: "12px", borderTop: "1px solid rgba(245,245,240,0.1)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <span style={{ fontSize: "12px", color: "rgba(245,245,240,0.6)" }}>{totalSelected} {totalSelected === 1 ? tr.eventDetailPage.seatSingular : tr.eventDetailPage.seatPlural}</span>
                        <span style={{ fontSize: "14px", color: "var(--afa-cream)" }}>₹{totalAmount.toLocaleString("en-IN")}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", gap: "12px" }}>
                        <div>
                          <div style={{ fontSize: "12px", color: "rgba(245,245,240,0.6)" }}>{tr.eventDetailPage.bookingFeeLabel}</div>
                          <div style={{ fontSize: "10px", color: "rgba(245,245,240,0.4)", maxWidth: "160px" }}>{tr.eventDetailPage.bookingFeeHint}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                          <span style={{ fontSize: "14px", color: "var(--afa-cream)" }}>₹</span>
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
                            style={{ width: "64px", padding: "6px 8px", borderRadius: "3px", border: "1px solid rgba(245,245,240,0.2)", background: "transparent", color: "var(--afa-cream)", fontSize: "14px", textAlign: "right" }}
                          />
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", borderTop: "1px solid rgba(245,245,240,0.1)" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--afa-cream)" }}>{tr.eventDetailPage.totalLabel}</span>
                        <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--afa-cream)" }}>₹{(totalAmount + feeInput).toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingTop: "12px", borderTop: "1px solid rgba(245,245,240,0.1)" }}>
                      <span style={{ fontSize: "12px", color: "rgba(245,245,240,0.6)" }}>{totalSelected} {totalSelected === 1 ? tr.eventDetailPage.seatSingular : tr.eventDetailPage.seatPlural}</span>
                      <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--afa-cream)" }}>{tr.eventDetailPage.freeAmount}</span>
                    </div>
                  )}

                  <button onClick={handleBookClick} disabled={reserving || status === "loading"} className="afa-book-btn" style={{ opacity: reserving || status === "loading" ? 0.7 : 1, cursor: reserving || status === "loading" ? "default" : "pointer" }}>
                    <TicketIcon style={{ width: "18px", height: "18px" }} />
                    {reserving ? tr.eventDetailPage.reserving : status === "loading" ? tr.eventDetailPage.loadingButton : event.isFree ? tr.eventDetailPage.confirmFreeBooking : tr.eventDetailPage.continueToCheckout}
                  </button>

                  <div style={{ marginTop: "12px", fontSize: "12px", color: "rgba(245,245,240,0.4)", textAlign: "center" }}>
                    {event.isFree ? tr.eventDetailPage.freeEntryFooter : tr.eventDetailPage.securePaymentFooter}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* THE FINE PRINT */}
        {(event.dresscode || event.vibe || event.ageLimit || event.termsChecklist?.length || (event.specialNotesStatus === 'APPROVED' && event.specialNotes)) && (
          <section style={{ marginTop: "64px" }}>
            <SectionEyebrow>{tr.eventDetailPage.theFinePrint}</SectionEyebrow>
            <div className="afa-event-meta-grid" style={{ marginTop: "16px" }}>
              {event.dresscode && <MetaTile icon={DressCodeIcon} label={tr.eventDetailPage.dressCode} value={event.dresscode} />}
              {event.vibe && <MetaTile icon={VibeIcon} label={tr.eventDetailPage.vibeLabel} value={event.vibe} />}
              <MetaTile icon={SurpriseIcon} label={tr.eventDetailPage.surpriseAct} value={event.surpriseAct ? tr.eventDetailPage.yes : tr.eventDetailPage.no} />
              {event.ageLimit && <MetaTile icon={AgeIcon} label={tr.eventDetailPage.ageLimitLabel} value={event.ageLimit} />}
            </div>

            {/* FEAT-2608-045 - checklist items the organiser selected at
                creation, AFA's platform-wide refund/cancellation policy
                (linked, not duplicated), and the organiser's free-text
                special note ONLY once admin-approved - same principle as
                the Feedback table never exposing unreviewed content
                publicly. Real functionality beyond the export's mockup,
                folded into this section since it's the same "fine print"
                territory. */}
            {(event.termsChecklist && event.termsChecklist.length > 0) || (event.specialNotesStatus === 'APPROVED' && event.specialNotes) ? (
              <div style={{ marginTop: "8px" }}>
                {event.termsChecklist && event.termsChecklist.length > 0 && (
                  <ul style={{ margin: 0, padding: "16px 0 0", listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {EVENT_TERMS_CHECKLIST.filter((t) => event.termsChecklist!.includes(t.key)).map((t) => (
                      <li key={t.key} style={{ fontSize: "14px", color: "rgba(245,245,240,0.8)", display: "flex", gap: "8px" }}>
                        <span style={{ color: "var(--afa-amber)" }}>·</span>
                        {tr.eventTermsChecklist[t.key as keyof typeof tr.eventTermsChecklist] || t.label}
                      </li>
                    ))}
                  </ul>
                )}
                {event.specialNotesStatus === 'APPROVED' && event.specialNotes && (
                  <div style={{ marginTop: "16px", borderRadius: "3px", border: "1px solid rgba(245,245,240,0.1)", background: "var(--afa-surface-raised)", padding: "14px 16px" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(245,245,240,0.4)", marginBottom: "6px" }}>{tr.eventDetailPage.specialNoteLabel}</div>
                    <div style={{ fontSize: "14px", color: "rgba(245,245,240,0.85)", lineHeight: 1.6 }}>{event.specialNotes}</div>
                  </div>
                )}
              </div>
            ) : null}
            <p style={{ fontSize: "13px", color: "rgba(245,245,240,0.45)", marginTop: "16px" }}>
              {tr.eventDetailPage.refundPolicyLinkText.split("{link}")[0]}
              <Link href={REFUND_POLICY_LINK} target="_blank" style={{ color: "var(--afa-amber)", fontWeight: 600 }}>{tr.eventDetailPage.refundPolicyLinkLabel}</Link>
              {tr.eventDetailPage.refundPolicyLinkText.split("{link}")[1]}
            </p>
          </section>
        )}

        {/* THE LINEUP */}
        <section style={{ marginTop: "64px" }}>
          <SectionEyebrow>{tr.eventDetailPage.lineupHeading}</SectionEyebrow>
          {event.lineup.length === 0 ? (
            <p style={{ marginTop: "16px", fontSize: "14px", color: "rgba(245,245,240,0.5)" }}>{tr.eventDetailPage.lineupNotConfirmed}</p>
          ) : (
            <div style={{ marginTop: "16px", borderTop: "1px solid rgba(245,245,240,0.1)" }}>
              {event.lineup.map((p) => {
                const performerName = p.artist.user.displayName || p.artist.user.name
                return (
                  <div key={p.id} className="afa-event-lineup-row" style={{ flexWrap: "wrap" }}>
                    <div style={{ position: "relative", width: "48px", height: "48px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "#241a10" }}>
                      {p.artist.user.avatar ? (
                        <img src={p.artist.user.avatar} alt={performerName} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1) contrast(1.25) brightness(0.9)" }} />
                      ) : (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: "18px", color: "var(--afa-amber)" }}>
                          {performerName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                      <div style={{ fontSize: "15px", color: "var(--afa-cream)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{performerName}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(245,245,240,0.4)", marginTop: "2px" }}>
                        {p.artist.genre.length > 0 ? p.artist.genre.join(", ") : tr.eventDetailPage.slotDuration.replace("{n}", String(p.slot)).replace("{duration}", String(p.duration))}
                      </div>

                      {event.plusOnesRequired > 0 && plusOneStatus[p.id] && (
                        <div style={{ marginTop: "8px" }}>
                          {plusOneStatus[p.id].alreadyConfirmed ? (
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--afa-amber)" }}>
                              {tr.eventDetailPage.plusOneConfirmedAs.replace("{name}", performerName.split(" ")[0])}
                            </span>
                          ) : plusOneStatus[p.id].fulfilled ? (
                            <span style={{ fontSize: "12px", color: "rgba(245,245,240,0.5)" }}>
                              {tr.eventDetailPage.plusOneFullySupported.replace("{confirmed}", String(plusOneStatus[p.id].confirmedCount)).replace("{required}", String(plusOneStatus[p.id].required))}
                            </span>
                          ) : (
                            <button
                              onClick={() => confirmPlusOne(p.id)}
                              disabled={plusOneBusy === p.id}
                              style={{ fontSize: "12px", fontWeight: 600, padding: "5px 12px", borderRadius: "3px", border: "1.5px solid var(--afa-amber)", background: "transparent", color: "var(--afa-amber)", cursor: plusOneBusy === p.id ? "default" : "pointer", opacity: plusOneBusy === p.id ? 0.6 : 1 }}
                            >
                              {plusOneBusy === p.id ? tr.eventDetailPage.plusOneConfirming : tr.eventDetailPage.plusOneIllBeThere.replace("{name}", performerName.split(" ")[0]).replace("{confirmed}", String(plusOneStatus[p.id].confirmedCount)).replace("{required}", String(plusOneStatus[p.id].required))}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Existing reviews */}
                      {(p.reviews.length > 0 || submittedReviews[p.id]) && (
                        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                          {submittedReviews[p.id] && !p.reviews.find((r) => r.id === submittedReviews[p.id].id) && (
                            <div style={{ fontSize: "13px", color: "rgba(245,245,240,0.75)" }}>
                              {submittedReviews[p.id].rating}/5 <span style={{ opacity: 0.6 }}>— {tr.eventDetailPage.reviewYouSuffix}</span>
                              {submittedReviews[p.id].comment && <span style={{ opacity: 0.7 }}> · {submittedReviews[p.id].comment}</span>}
                            </div>
                          )}
                          {p.reviews.slice(0, 3).map((r) => (
                            <div key={r.id}>
                              <div style={{ fontSize: "13px", color: "rgba(245,245,240,0.75)" }}>
                                {r.rating}/5 <span style={{ opacity: 0.6 }}>— {r.user.displayName || r.user.name}</span>
                                {r.comment && <span style={{ opacity: 0.7 }}> · {r.comment}</span>}
                              </div>
                              {r.reply && (
                                <div style={{ fontSize: "12px", color: "rgba(245,245,240,0.6)", marginTop: "3px", marginLeft: "16px", paddingLeft: "10px", borderLeft: "2px solid rgba(201,151,58,0.3)" }}>
                                  <strong>{r.reply.author.displayName || r.reply.author.name}</strong> {tr.eventDetailPage.repliedLabel} {r.reply.text}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Rate this performer — only shown to viewers the server has
                          confirmed have a checked-in booking for this event
                          (canReview, computed in the parent server component). */}
                      {canReview && !submittedReviews[p.id] && !p.reviews.some((r) => r.user.name === (session?.user as any)?.name) && (
                        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(245,245,240,0.08)" }}>
                          <div style={{ display: "flex", gap: "4px", marginBottom: "8px", alignItems: "center" }}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                onClick={() => setReviewDrafts((prev) => ({ ...prev, [p.id]: { rating: n, comment: prev[p.id]?.comment || "" } }))}
                                style={{ width: "20px", height: "20px", borderRadius: "50%", background: "none", border: "1px solid var(--afa-amber)", cursor: "pointer", fontSize: "10px", padding: 0, color: "var(--afa-amber)", opacity: (reviewDrafts[p.id]?.rating || 0) >= n ? 1 : 0.3 }}
                              >
                                {n}
                              </button>
                            ))}
                            {reviewDrafts[p.id]?.rating > 0 && (
                              <button
                                onClick={() => submitReview(p.id)}
                                disabled={reviewSubmitting === p.id}
                                style={{ marginLeft: "8px", fontSize: "12px", fontWeight: 600, color: "var(--afa-on-fill-solid)", background: "var(--afa-fill-solid)", border: "none", borderRadius: "3px", padding: "4px 12px", cursor: "pointer", opacity: reviewSubmitting === p.id ? 0.6 : 1 }}
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
                              style={{ width: "100%", padding: "6px 10px", borderRadius: "3px", border: "1px solid rgba(245,245,240,0.15)", background: "transparent", color: "var(--afa-cream)", fontSize: "13px", boxSizing: "border-box" }}
                            />
                          )}
                          {reviewError && <p style={{ fontSize: "12px", color: "var(--afa-error)", marginTop: "6px" }}>{reviewError}</p>}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {p.hypeScore != null && (
                        <>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(245,245,240,0.35)" }}>
                            {tr.eventDetailPage.hypeLabel}
                          </div>
                          <div style={{ marginTop: "4px" }}>
                            <HypeStat value={p.hypeScore} />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* COMPETITION SHOW - prizes, celebrities, panelists, voting.
            Only rendered when the real data has this flag set. */}
        {event.isCompetitionShow && (
          <section style={{ marginTop: "64px" }}>
            <SectionEyebrow>{tr.eventDetailPage.competitionShow}</SectionEyebrow>

            {(event.competitionPrizeFirst || event.competitionPrizeSecond || event.competitionPrizeThird) && (
              <div className="afa-event-prize-grid" style={{ marginTop: "16px" }}>
                {[
                  { rank: tr.eventDetailPage.firstPrize, value: event.competitionPrizeFirst, top: true },
                  { rank: tr.eventDetailPage.secondPrize, value: event.competitionPrizeSecond, top: false },
                  { rank: tr.eventDetailPage.thirdPrize, value: event.competitionPrizeThird, top: false },
                ].filter((p) => p.value).map((p) => (
                  <div key={p.rank} style={{ display: "flex", flexDirection: "column", gap: "12px", borderRadius: "3px", border: "1px solid rgba(245,245,240,0.1)", background: "var(--afa-surface-raised)", padding: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <TrophyIcon style={{ width: "20px", height: "20px", color: p.top ? "var(--afa-amber)" : "rgba(245,245,240,0.4)" }} />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(245,245,240,0.5)" }}>{p.rank}</span>
                    </div>
                    <p style={{ fontSize: "14px", lineHeight: 1.6, color: "rgba(245,245,240,0.85)", margin: 0 }}>{p.value}</p>
                  </div>
                ))}
              </div>
            )}

            {event.celebrities && event.celebrities.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
                {event.celebrities.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "14px", borderRadius: "3px", border: "1px solid rgba(245,245,240,0.1)", background: "var(--afa-surface-raised)", padding: "14px 16px" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "#241a10", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {c.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.photoUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1) contrast(1.25) brightness(0.9)" }} />
                      ) : (
                        <TrophyIcon style={{ width: "20px", height: "20px", color: "var(--afa-amber)" }} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(245,245,240,0.4)" }}>{tr.eventDetailPage.celebrityAttending}</div>
                      <div style={{ fontSize: "15px", color: "var(--afa-cream)", marginTop: "2px" }}>{c.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {event.panelists && event.panelists.length > 0 && (
              <div style={{ marginTop: "20px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(245,245,240,0.4)", marginBottom: "10px" }}>{tr.eventDetailPage.panelists}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                  {event.panelists.map((p) => (
                    <div key={p.id} style={{ display: "flex", gap: "12px", borderRadius: "3px", border: "1px solid rgba(245,245,240,0.1)", background: "var(--afa-surface-raised)", padding: "14px" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "3px", overflow: "hidden", flexShrink: 0, background: "#241a10", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {p.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.photoUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1) contrast(1.25) brightness(0.9)" }} />
                        ) : (
                          <PinIcon style={{ width: "16px", height: "16px", color: "var(--afa-amber)" }} />
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: "14px", color: "var(--afa-cream)" }}>{p.name}</div>
                        {p.bio && <div style={{ fontSize: "12px", color: "rgba(245,245,240,0.55)", marginTop: "2px" }}>{p.bio}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: "24px" }}>
              <AudienceChoiceVoting eventId={event.id} isCompetitionShow={event.isCompetitionShow} />
            </div>
          </section>
        )}

        {/* VENUE FACILITIES */}
        {event.venue && event.venue.facilities.length > 0 && (
          <section style={{ marginTop: "64px" }}>
            <SectionEyebrow>{tr.eventDetailPage.venueDetailsHeading}</SectionEyebrow>
            <div className="afa-event-facility-grid" style={{ marginTop: "16px" }}>
              {event.venue.facilities.map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: "12px", borderTop: "1px solid rgba(245,245,240,0.1)", padding: "16px 0" }}>
                  <FacilityIcon label={f} style={{ width: "18px", height: "18px", flexShrink: 0, color: "var(--afa-amber)" }} />
                  <span style={{ fontSize: "14px", color: "rgba(245,245,240,0.85)" }}>{f}</span>
                </div>
              ))}
            </div>
          </section>
        )}
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
