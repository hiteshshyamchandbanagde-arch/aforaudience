"use client"
import { getAvailabilityStatus } from "@/lib/availability"
import { useLocale } from "@/lib/i18n/translate"
import Photo from "@/components/Photo"
import { EventTypeIcon, CalendarIcon, ClockIcon, PinIcon } from "@/components/icons/EventIcons"

export interface EventItem {
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
  posterImage: string | null
  lineup: { id: string; artist: { id: string; user: { name: string; displayName: string | null } } }[]
  isCompetitionShow?: boolean
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('')
}

// Circular artist-initials chips for a multi-artist lineup, per the V2
// spec (PM/AB/RD/NK style) - a cheap way to show a bill without needing a
// real photo per performer. Caps at 4 visible + an overflow "+N" chip.
//
// Still used by the homepage bento tiles (src/app/page.tsx) - kept
// exactly as-is for GEN-2608-077 (this component's own card below no
// longer uses it, since the approved Events export doesn't show a
// lineup preview on the card at all - see the audit note in
// EventCard's own comment below).
export function LineupChips({ lineup, size = 26 }: { lineup: EventItem["lineup"]; size?: number }) {
  if (lineup.length === 0) return null
  const visible = lineup.slice(0, 4)
  const overflow = lineup.length - visible.length
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {visible.map((l, i) => {
        const name = l.artist.user.displayName || l.artist.user.name
        return (
          <div
            key={l.id}
            title={name}
            style={{
              width: size,
              height: size,
              marginLeft: i === 0 ? 0 : -size * 0.28,
              borderRadius: "50%",
              background: "var(--afa-surface-raised, #1F1F1F)",
              border: "1px solid rgba(245,245,240,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: size * 0.34,
              fontFamily: "var(--font-mono)",
              color: "var(--afa-amber)",
              flexShrink: 0,
            }}
          >
            {initials(name)}
          </div>
        )
      })}
      {overflow > 0 && (
        <div
          style={{
            width: size,
            height: size,
            marginLeft: -size * 0.28,
            borderRadius: "50%",
            background: "var(--afa-surface-raised, #1F1F1F)",
            border: "1px solid rgba(245,245,240,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size * 0.3,
            fontFamily: "var(--font-mono)",
            color: "rgba(245,245,240,0.6)",
            flexShrink: 0,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}

// Still used by the homepage bento tiles (src/app/page.tsx) for their
// fallback-tile background color/emoji - untouched, out of scope for
// this redesign (a separate, already-shipped "Four rooms" homepage
// project). The Events directory/detail pages below use the export's
// own illustrated-fallback treatment (IllustratedEventFallback)
// instead, not this map.
export const TYPE_META: Record<string, { emoji: string; color: string; label: string }> = {
  OPEN_MIC: { emoji: "🎤", color: "var(--afa-green-black)", label: "Open Mic" },
  STAND_UP: { emoji: "😂", color: "var(--afa-maroon-black)", label: "Stand Up" },
  POETRY: { emoji: "📜", color: "var(--afa-indigo-black)", label: "Poetry" },
  THEATER: { emoji: "🎩", color: "var(--afa-plum-black)", label: "Theater" },
  LINEUP: { emoji: "🌟", color: "var(--afa-brown-black)", label: "Lineup" },
}

// Quiet mono type badge (export: bits.tsx TypeBadge) - icon + uppercase
// label, no pill/chip background of its own. The card overlays this
// inside a separate backdrop-blur chip (see EventCard below); the
// detail hero and directory filter row use it bare.
export function EventTypeBadge({ type, typeLabel, size = 16, style }: { type: string; typeLabel: string; size?: number; style?: React.CSSProperties }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(245,245,240,0.7)", ...style }}>
      <EventTypeIcon type={type} style={{ width: size, height: size, color: "var(--afa-amber)" }} />
      {typeLabel}
    </span>
  )
}

// Export's IllustratedFallback (Poster.tsx) - concentric amber rings
// keyed to the event-type mark, plus a "No poster · Type" caption.
// Distinct from the grid-texture treatment used on Venues (a different
// export with its own approved fallback language) - ported faithfully
// to what THIS export actually shows, not assumed to match Venues.
export function IllustratedEventFallback({ type, typeLabel }: { type: string; typeLabel: string }) {
  const { t: tr } = useLocale()
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#241a10" }}>
      <svg viewBox="0 0 200 250" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", color: "rgba(201,151,58,0.25)" }} fill="none" stroke="currentColor" strokeWidth="0.6">
        {Array.from({ length: 7 }).map((_, i) => (
          <circle key={i} cx="100" cy="118" r={22 + i * 20} />
        ))}
        <line x1="0" y1="118" x2="200" y2="118" />
        <line x1="100" y1="0" x2="100" y2="250" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", color: "var(--afa-amber)" }}>
        <EventTypeIcon type={type} style={{ width: "44px", height: "44px", opacity: 0.9 }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.2em", opacity: 0.7 }}>
          {tr.eventsPage.noPosterCaption.replace("{type}", typeLabel)}
        </span>
      </div>
    </div>
  )
}

// Real photo (Photo.tsx's already-verified amber/sepia duotone) or the
// illustrated fallback - shared by the card poster and the detail-page
// hero. Deliberately NOT the export's own `.duotone` CSS (mix-blend-mode:
// lighten against amber, floods real photos with a salmon/coral cast,
// confirmed broken by testing it against a mock event's posterImage) -
// Photo.tsx's grayscale+contrast+brightness base plus a single #C9973A
// multiply overlay at 0.48 opacity is the correct, already-shipped
// recipe (see docs/venues-full-fidelity-audit-2026-08-20.md's
// "Re-checked, no action needed" section).
export function EventPoster({ posterImage, title, type, typeLabel }: { posterImage: string | null; title: string; type: string; typeLabel: string }) {
  return posterImage ? <Photo src={posterImage} alt={title} /> : <IllustratedEventFallback type={type} typeLabel={typeLabel} />
}

// Export's SeatState (bits.tsx) - a small colored dot + label, not a
// pill badge or a fire emoji. Reuses the real, already-correct
// getAvailabilityStatus()/tr.availability (ratio-based, sold-out
// handled explicitly) rather than the export's own mock seatState()
// thresholds.
export function SeatStateDot({ totalSeats, availableSeats, showCount = false }: { totalSeats: number; availableSeats: number; showCount?: boolean }) {
  const { t: tr } = useLocale()
  const status = getAvailabilityStatus(totalSeats, availableSeats)
  const color = status === "filling-fast" ? "var(--afa-fill-solid)" : status === "sold-out" ? "rgba(245,245,240,0.35)" : "rgba(245,245,240,0.55)"
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", color }}>
      <span style={{ position: "relative", display: "inline-flex", width: "8px", height: "8px", flexShrink: 0 }}>
        {status === "filling-fast" && (
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--afa-fill-solid)", opacity: 0.6, animation: "afa-ping 1.6s cubic-bezier(0,0,0.2,1) infinite" }} />
        )}
        <span style={{ position: "relative", width: "8px", height: "8px", borderRadius: "50%", background: color }} />
      </span>
      {tr.availability[status]}
      {showCount && status !== "sold-out" && (
        <span style={{ color: "rgba(245,245,240,0.4)" }}>· {availableSeats}{tr.eventsPage.leftSuffix}</span>
      )}
    </span>
  )
}

// GEN-2608-077 - wholesale rebuild against the approved Figma Make
// export (EventCard.tsx). The export's card has no lineup-chip preview,
// no colored per-type background block, no emoji, and no pill badges -
// poster (real duotone photo or the illustrated fallback), a quiet
// backdrop-blur type chip overlaid top-left, title, a calendar+clock /
// pin meta row, and a price + seat-state-dot row at the bottom. `bg-ink-
// raised` card fill and `rounded-sm` corners are this export's own
// signature (a different export from Venues, verified independently
// rather than assumed to share Venues' zero-fill sharp-corner rule).
export function EventCard({
  event,
  view,
  tab,
  isNavigating,
  disabled,
  onOpen,
}: {
  event: EventItem
  view: "grid" | "list"
  tab: string
  isNavigating: boolean
  disabled: boolean
  onOpen: () => void
}) {
  const { t: tr } = useLocale()
  const typeKey = (event.type in tr.eventTypes ? event.type : "OPEN_MIC") as keyof typeof tr.eventTypes
  const typeLabel = tr.eventTypes[typeKey]
  const priceLabel = event.isFree ? tr.eventsPage.freeBadge : event.ticketPrice ? `₹${event.ticketPrice}` : "—"

  return (
    <div
      role="link"
      tabIndex={0}
      aria-busy={isNavigating}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      className={`afa-event-card${view === "grid" ? " afa-event-card-grid" : " afa-event-card-list"}`}
      style={{
        position: "relative",
        display: view === "list" ? "flex" : "flex",
        flexDirection: view === "list" ? "row" : "column",
        gap: view === "list" ? "20px" : 0,
        overflow: "hidden",
        background: "var(--afa-surface-raised)",
        borderRadius: "3px",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !isNavigating ? 0.5 : 1,
        transition: "opacity 0.15s ease",
        padding: view === "list" ? "16px" : 0,
      }}
    >
      {isNavigating && (
        <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "rgba(10,10,10,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "26px", height: "26px", borderRadius: "50%", border: "3px solid rgba(245,245,240,0.15)", borderTopColor: "var(--afa-amber)", animation: "afa-spin 0.7s linear infinite" }} />
        </div>
      )}

      <div className="afa-event-card-poster" style={{ position: "relative", overflow: "hidden", borderRadius: "3px", flexShrink: 0 }}>
        <EventPoster posterImage={event.posterImage} title={event.title} type={event.type} typeLabel={typeLabel} />
        <span style={{ position: "absolute", left: "12px", top: "12px", display: "inline-flex", background: "rgba(10,10,10,0.7)", backdropFilter: "blur(4px)", padding: "6px 10px", borderRadius: "2px" }}>
          <EventTypeBadge type={event.type} typeLabel={typeLabel} size={14} />
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: "16px", padding: view === "grid" ? "20px" : 0 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: view === "grid" ? "24px" : "22px", lineHeight: 1.2, color: "var(--afa-cream)", margin: 0 }}>
          {event.title}
        </h3>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "rgba(245,245,240,0.65)" }}>
            <CalendarIcon style={{ width: "15px", height: "15px", color: "rgba(245,245,240,0.4)", flexShrink: 0 }} />
            <span>{new Date(event.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
            <ClockIcon style={{ width: "15px", height: "15px", color: "rgba(245,245,240,0.4)", flexShrink: 0, marginLeft: "4px" }} />
            <span>{event.startTime}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "rgba(245,245,240,0.65)" }}>
            <PinIcon style={{ width: "15px", height: "15px", color: "rgba(245,245,240,0.4)", flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {event.venue ? `${event.venue.name}, ${event.venue.city}` : tr.eventsPage.venueTBD}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(245,245,240,0.1)", paddingTop: "12px", marginTop: "6px" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "rgba(245,245,240,0.8)" }}>{priceLabel}</span>
            {tab === "past" ? (
              <span style={{ fontSize: "13px", color: "rgba(245,245,240,0.5)" }}>{tr.eventsPage.ended}</span>
            ) : (
              <SeatStateDot totalSeats={event.totalSeats} availableSeats={event.availableSeats} showCount={view === "list"} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
