"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession, getSession } from "next-auth/react"
import SiteNav from "@/components/SiteNav"
import AuthPromptSheet from "@/components/AuthPromptSheet"
import SeatPicker from "@/components/SeatPicker"
import { colorForZone } from "@/components/SeatLayoutPreview"
import { SeatStateDot } from "@/components/EventCard"
import { TicketIcon } from "@/components/icons/EventIcons"
import { useLocale } from "@/lib/i18n/translate"

// GEN-2609-004 (Mobile Redesign Phase 2) - the interactive booking panel
// (seat/tier picker, fee slider, Book button), relocated out of
// EventDetailClientPage.tsx into its own route. This is a relocation, not
// a rewrite - every piece of state/logic below is unchanged from that
// file, just no longer sharing a component with the review/lineup/
// plus-one sections that stayed on EventDetail. See that file's own
// history/comments for why each piece works the way it does; only
// genuinely new here is the page-level wrapper (SiteNav back-link,
// container) and the isPast/reservedMessage full-page states, which used
// to be one branch inside EventDetail's larger render and are now this
// page's only render paths.

interface TicketTier {
  id: string
  sectionName: string
  price: number
  totalSeats: number
}

interface EventData {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  isFree: boolean
  ticketPrice: number | null
  totalSeats: number
  availableSeats: number
  maxSeatsPerBooking: number
  venue: { name: string; address: string; city: string; seatingMode?: 'GENERAL_ADMISSION' | 'NUMBERED' } | null
  ticketTiers: TicketTier[]
}

// Same instant-comparison convention used everywhere else this check
// happens (EventDetailClientPage.tsx, events/page.tsx, POST /api/bookings).
function isPastEvent(e: { date: string; startTime: string }): boolean {
  const [h, m] = e.startTime.split(':').map(Number)
  const eventStart = new Date(e.date)
  eventStart.setHours(h, m, 0, 0)
  return eventStart.getTime() <= Date.now()
}

export default function SeatSelectionClientPage({ event }: { event: EventData | null }) {
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

  // Audience-adjustable booking fee (28 Jul) - unchanged from EventDetail,
  // see that file's own comment for the full rationale.
  const [defaultBookingFee, setDefaultBookingFee] = useState<number | null>(null)
  const [feeInput, setFeeInput] = useState<number>(0)
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

  // Same Router Cache staleness fix as EventDetailClientPage.tsx (live-
  // caught 28 Jul) - the seat/ticket availability shown here is exactly
  // what that bug affected, so this page needs the same guard.
  useEffect(() => {
    router.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          router.push(`/verify-phone?next=${encodeURIComponent(`/events/${event.id}/seats`)}`)
          return
        }
        throw new Error(data.error || tr.eventDetailPage.reserveFailed)
      }

      // Two possible responses:
      //   - payment is attached -> Razorpay was configured; go to checkout
      //   - no payment (message only) -> this env doesn't have Razorpay
      //     yet, so show the "reserved, we'll email you" state right here.
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

  const handleBookClick = async () => {
    if (totalSelected === 0) {
      setBookingError(tr.eventDetailPage.selectSeatFirst)
      return
    }
    if (!event) return
    if (isPastEvent(event)) {
      setBookingError(tr.eventDetailPage.eventAlreadyHappened)
      return
    }
    if (status === "loading") {
      return
    }
    if (status !== "authenticated") {
      // BUG-2608-055 - see EventDetailClientPage.tsx's own comment for why
      // this asks the server directly rather than trusting the client
      // hook's possibly-stale "unauthenticated" reading right after login.
      const freshSession = await getSession()
      if (freshSession?.user) {
        // Genuinely already signed in.
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
        <div style={{ maxWidth: "560px", margin: "0 auto", padding: "48px 24px", color: "var(--afa-text-primary)" }}>{tr.eventDetailPage.notFound}</div>
      </main>
    )
  }

  const isPast = isPastEvent(event)

  return (
    <>
      <style>{`
        .afa-book-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; background: var(--afa-fill-solid); color: var(--afa-on-fill-solid); padding: 14px; border-radius: 3px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: filter 0.2s ease; }
        .afa-book-btn:hover { filter: brightness(1.08); }
      `}</style>
      <SiteNav backHref={`/events/${event.id}`} backLabel={tr.checkoutPage.backToEventLabel} />
      <main style={{ minHeight: "100vh", background: "var(--afa-surface-page)", maxWidth: "560px", margin: "0 auto", padding: "32px 20px 64px", fontFamily: "var(--font-sans)", color: "var(--afa-text-primary)" }}>
        <div style={{ marginBottom: "8px", fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", color: "var(--afa-amber)" }}>
          {tr.eventDetailPage.selectTicketsCta}
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700, color: "var(--afa-cream)", marginBottom: "4px" }}>
          {event.title}
        </h1>
        {event.venue && (
          <p style={{ fontSize: "13px", color: "rgba(245,245,240,0.55)", marginBottom: "24px" }}>
            {event.venue.name}, {event.venue.city}
          </p>
        )}

        <div style={{ borderRadius: "3px", border: "1px solid rgba(245,245,240,0.1)", background: "var(--afa-surface-raised)", padding: "20px" }}>
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

              {/* GEN-2609-010 - price-tier legend, additive/display-only:
                  reconciliation with Figma v2's SeatMap.tsx found the
                  NUMBERED path already gets an equivalent color legend for
                  free (SeatPicker.tsx renders one above its own canvas,
                  using this same colorForZone helper). The actual gap was
                  here - the flat tier list had no color coding at all.
                  Only shown for >1 tier; a single price isn't a "legend". */}
              {!event.isFree && !isNumbered && event.ticketTiers.length > 1 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                  {event.ticketTiers.map((t) => (
                    <span key={t.id} style={{ display: "inline-flex", alignItems: "center", fontSize: "11px", color: "var(--afa-cream)", background: "rgba(245,245,240,0.08)", padding: "4px 10px", borderRadius: "999px" }}>
                      <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: colorForZone(t.sectionName, event.ticketTiers.map((tier) => tier.sectionName)), marginRight: "6px" }} />
                      {t.sectionName} · ₹{t.price}
                    </span>
                  ))}
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
      </main>

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
    </>
  )
}
