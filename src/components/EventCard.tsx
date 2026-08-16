"use client"
import { getAvailabilityStatus, AVAILABILITY_BADGE } from "@/lib/availability"
import { isNightEvent } from "@/lib/eventTime"
import { useLocale } from "@/lib/i18n/translate"
import Photo from "@/components/Photo"

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

export const TYPE_META: Record<string, { emoji: string; color: string; label: string }> = {
  OPEN_MIC: { emoji: "🎤", color: "var(--afa-green-black)", label: "Open Mic" },
  STAND_UP: { emoji: "😂", color: "var(--afa-maroon-black)", label: "Stand Up" },
  POETRY: { emoji: "📜", color: "var(--afa-indigo-black)", label: "Poetry" },
  THEATER: { emoji: "🎩", color: "var(--afa-plum-black)", label: "Theater" },
  LINEUP: { emoji: "🌟", color: "var(--afa-brown-black)", label: "Lineup" },
}

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
  const meta = TYPE_META[event.type] || TYPE_META.OPEN_MIC
  const typeKey = (event.type in TYPE_META ? event.type : "OPEN_MIC") as keyof typeof tr.eventTypes
  const typeLabel = tr.eventTypes[typeKey]

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
      className="hover-lift-card"
      style={{
        background: "white",
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid rgba(245,245,240,0.08)",
        textDecoration: "none",
        color: "inherit",
        display: "block",
        position: "relative",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !isNavigating ? 0.5 : 1,
        transition: "opacity 0.15s ease",
      }}
    >
      {isNavigating && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            background: "rgba(255,255,255,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              border: "3px solid rgba(245,245,240,0.15)",
              borderTopColor: "var(--afa-amber)",
              animation: "afa-spin 0.7s linear infinite",
            }}
          />
          <style>{`@keyframes afa-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      {view === "grid" && (
        <div style={{ height: "160px", background: meta.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "64px", position: "relative" }}>
          {event.posterImage ? <Photo src={event.posterImage} alt={event.title} /> : meta.emoji}
          <span style={{ position: "absolute", top: "12px", left: "12px", background: "var(--afa-amber)", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "4px", letterSpacing: "0.05em" }}>
            {typeLabel.toUpperCase()}
          </span>
          <span style={{ position: "absolute", top: "12px", right: "12px", background: event.isFree ? "var(--afa-green-mid)" : "rgba(201,151,58,0.9)", color: "white", fontSize: "12px", fontWeight: 600, padding: "4px 10px", borderRadius: "4px" }}>
            {event.isFree ? tr.eventsPage.freeBadge : event.ticketPrice ? `₹${event.ticketPrice}` : "—"}
          </span>
          {event.isCompetitionShow && (
            <span style={{ position: "absolute", bottom: "12px", left: "12px", background: "rgba(245,245,240,0.75)", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "4px" }}>
              🏆 {tr.eventsPage.competitionBadge}
            </span>
          )}
          {tab === "past" ? (
            <span style={{ position: "absolute", bottom: "12px", right: "12px", background: "rgba(245,245,240,0.75)", color: "white", fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "4px" }}>
              {tr.eventsPage.ended}
            </span>
          ) : (() => {
            const status = getAvailabilityStatus(event.totalSeats, event.availableSeats)
            if (status === 'available') return null
            const badge = AVAILABILITY_BADGE[status]
            const statusLabel = tr.availability[status]
            return (
              <span style={{ position: "absolute", bottom: "12px", right: "12px", background: badge.bg, color: badge.color, fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "4px" }}>
                {status === 'filling-fast' ? `🔥 ${statusLabel} · ${event.availableSeats}${tr.eventsPage.leftSuffix}` : statusLabel}
              </span>
            )
          })()}
        </div>
      )}

      <div style={{ padding: "20px", display: view === "list" ? "flex" : "block", gap: "24px", alignItems: "center" }}>
        {view === "list" && (
          <div style={{ width: "60px", height: "60px", background: meta.color, borderRadius: "12px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", position: "relative", flexShrink: 0 }}>
            {event.posterImage ? <Photo src={event.posterImage} alt={event.title} /> : meta.emoji}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--afa-amber)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>
            {event.venue ? `${event.venue.name} · ${event.venue.city}` : tr.eventsPage.venueTBD}
          </div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "8px", lineHeight: 1.2 }}>
            {event.title}
          </div>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.6 }}>📅 {new Date(event.date).toLocaleDateString()}</span>
            <span style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.6 }}>🕐 {event.startTime}</span>
            {isNightEvent(event.startTime) && (
              <span style={{ fontSize: "13px", color: "var(--afa-plum, #6B4E71)", opacity: 0.85 }} title={tr.eventsPage.nightTitle}>🌙 {tr.eventsPage.nightLabel}</span>
            )}
            {event.lineup.length > 0 && <LineupChips lineup={event.lineup} />}
          </div>
          {view === "list" && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ background: event.isFree ? "var(--afa-green-mid)" : "var(--afa-amber)", color: "white", fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "4px" }}>
                {event.isFree ? tr.eventsPage.freeBadge : event.ticketPrice ? `₹${event.ticketPrice}` : "—"}
              </span>
              <span style={{ fontSize: "12px", color: "var(--afa-ink)", opacity: 0.5 }}>{typeLabel}</span>
              {tab === "past" ? (
                <span style={{ fontSize: "12px", color: "var(--afa-ink)", fontWeight: 600, opacity: 0.6 }}>{tr.eventsPage.ended}</span>
              ) : (() => {
                const status = getAvailabilityStatus(event.totalSeats, event.availableSeats)
                if (status === 'available') return null
                const statusLabel = tr.availability[status]
                return (
                  <span style={{ fontSize: "12px", color: status === 'sold-out' ? "var(--afa-ink)" : "var(--afa-red-alt)", fontWeight: 600 }}>
                    {status === 'filling-fast' ? `🔥 ${statusLabel} · ${event.availableSeats}${tr.eventsPage.leftSuffix}` : statusLabel}
                  </span>
                )
              })()}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginTop: view === "grid" ? "12px" : "0", flexShrink: 0 }}>
          <span style={{ background: "var(--afa-fill-solid)", color: "white", padding: "10px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600 }}>
            {tr.eventsPage.viewEvent}
          </span>
        </div>
      </div>
    </div>
  )
}
