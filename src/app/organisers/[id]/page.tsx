"use client"
import { useEffect, useState, use } from "react"
import Link from "next/link"
import SiteNav from "@/components/SiteNav"
import BrandLoader from "@/components/BrandLoader"
import Photo from "@/components/Photo"
import OrganiserFollowButton from "./OrganiserFollowButton"
import { isPlaceholderImageUrl } from "@/lib/placeholder-image"
import { CalendarIcon, ClockIcon, PinIcon } from "@/components/icons/EventIcons"
import { ArrowIcon } from "@/components/icons/ArtistIcons"
import { RouteIcon } from "@/components/icons/OrganiserIcons"
import { useLocale, type Dictionary } from "@/lib/i18n/translate"

// Full rebuild (this session) against the approved Figma Make export
// ("Organiser Profile Page Design") - replaces the old white "Events by
// {name}" panel/black-on-white rows (pre-Phase-2c, confirmed stale via
// live screenshot) with the same dark/sharp-corner convention already
// shipped on Venues/Events/Artists. Structure follows the export
// (breadcrumb, square-avatar hero, Upcoming/Past Events, Tours); styling
// is reimplemented on real --afa-* tokens and shared components (Photo,
// OrganiserFollowButton, the icons already in EventIcons/VenueIcons/
// ArtistIcons) rather than the export's raw Tailwind classes.
//
// Deviations from the export (Claude + Hitesh decision, this session):
// - Past Events is capped at PAST_EVENTS_PAGE_SIZE with a "View all N"
//   expand, since an active organiser accumulates past events
//   indefinitely - the export's own mock only has 2 and never needed
//   this. Upcoming and Tours are left uncapped (self-limiting / low
//   volume), but Tours is structured so a future cap is one line (see
//   TOUR_DISPLAY_LIMIT below).
// - SectionHeader's count badge always reflects the TOTAL count, not
//   the capped/visible subset - the eyebrow number stays honest even
//   while Past Events is collapsed.
// - Past Events gets a real empty state when zero (title/body, matching
//   Upcoming/Tours) instead of the export's behavior of hiding the
//   whole section - this page's brief explicitly requires all three
//   sections to have a designed empty state, not blank space.
// - TourCard is NOT a link (the export wraps it in `<a href="#">`, a
//   placeholder for its own mockup) - there is no tour detail route in
//   this app, so making the whole card clickable would point nowhere.
// - Avatar and card-status colors are gated through isPlaceholderImageUrl
//   (src/lib/placeholder-image.ts) before being treated as a real photo -
//   same guard OrganisersGridEmbed uses, for the identical seed-data
//   placeholder-avatar class of bug.

interface OrganiserEventVenue {
  name: string
  city: string
}
interface OrganiserEvent {
  id: string
  title: string
  date: string
  startTime: string
  status: string
  venue: OrganiserEventVenue | null
}
interface OrganiserTourStop {
  id: string
  date: string
  venue: { city: string } | null
}
interface OrganiserTour {
  id: string
  title: string
  status: string
  stops: OrganiserTourStop[]
}
interface OrganiserDetail {
  id: string
  orgName: string
  code: string | null
  bio: string | null
  createdAt: string
  user: { name: string; avatar: string | null }
  events: OrganiserEvent[]
  tours: OrganiserTour[]
}

// Same date+startTime instant-comparison pattern as events/page.tsx's
// isPastEvent - kept consistent so "past" means the same thing
// everywhere in the app.
function isPastEvent(e: { date: string; startTime: string }): boolean {
  const [h, m] = e.startTime.split(":").map(Number)
  const eventStart = new Date(e.date)
  eventStart.setHours(h, m, 0, 0)
  return eventStart.getTime() <= Date.now()
}

function formatStartTime(startTime: string): string {
  const [hStr, mStr] = startTime.split(":")
  const h = Number(hStr)
  const period = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr.padStart(2, "0")} ${period}`
}

function tourCities(stops: OrganiserTourStop[]): string[] {
  const seen = new Set<string>()
  for (const s of stops) {
    if (s.venue?.city) seen.add(s.venue.city)
  }
  return Array.from(seen)
}

function formatTourWindow(stops: OrganiserTourStop[]): string {
  if (stops.length === 0) return ""
  const dates = stops.map((s) => new Date(s.date)).sort((a, b) => a.getTime() - b.getTime())
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", year: "numeric" })
  const first = fmt(dates[0])
  const last = fmt(dates[dates.length - 1])
  return first === last ? first : `${first} — ${last}`
}

const PAST_EVENTS_PAGE_SIZE = 5
// Naturally low-volume today (no organiser runs many concurrent/wrapped
// tours) so no cap is applied yet - if that changes, slice `tours` to
// this limit below the same way `past` is sliced to PAST_EVENTS_PAGE_SIZE.
const TOUR_DISPLAY_LIMIT = Infinity

function SectionHeader({ eyebrow, count }: { eyebrow: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "12px", borderBottom: "1px solid rgba(245,245,240,0.1)", paddingBottom: "12px" }}>
      <h2 style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--afa-amber)" }}>{eyebrow}</h2>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", color: "rgba(245,245,240,0.4)" }}>{String(count).padStart(2, "0")}</span>
    </div>
  )
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", border: "1px dashed rgba(245,245,240,0.15)", background: "rgba(31,31,31,0.4)", padding: "56px 24px", textAlign: "center" }}>
      <span style={{ color: "var(--afa-amber)" }}>{icon}</span>
      <div>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 500, color: "var(--afa-text-primary)" }}>{title}</h3>
        <p style={{ margin: "8px auto 0", maxWidth: "420px", fontSize: "15px", lineHeight: 1.6, color: "var(--afa-text-secondary)" }}>{body}</p>
      </div>
    </div>
  )
}

function EventDateCard({ event, tr }: { event: OrganiserEvent; tr: Dictionary }) {
  const d = new Date(event.date)
  const month = d.toLocaleDateString("en-IN", { month: "short" }).toUpperCase()
  const day = d.getDate()
  return (
    <Link
      href={`/events/${event.id}`}
      className="hover-lift-card afa-focusable afa-organiser-event-card"
      style={{ display: "flex", alignItems: "flex-start", gap: "20px", background: "var(--afa-surface-raised)", padding: "24px", textDecoration: "none" }}
    >
      <div style={{ display: "flex", flexShrink: 0, width: "56px", flexDirection: "column", alignItems: "center", border: "1px solid rgba(245,245,240,0.1)", padding: "8px 0" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--afa-amber)" }}>{month}</span>
        <span style={{ marginTop: "4px", fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 500, color: "var(--afa-text-primary)" }}>{day}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 className="afa-organiser-event-title" style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 500, lineHeight: 1.2, color: "var(--afa-text-primary)", transition: "color 0.3s ease" }}>
          {event.title}
        </h4>
        <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--afa-text-secondary)" }}>
            <ClockIcon style={{ width: "14px", height: "14px", color: "var(--afa-amber)" }} />
            {formatStartTime(event.startTime)}
          </span>
          {event.venue && (
            <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--afa-text-secondary)" }}>
              <PinIcon style={{ width: "14px", height: "14px", color: "var(--afa-amber)" }} />
              {event.venue.name}, {event.venue.city}
            </span>
          )}
        </div>
      </div>
      <span
        className="afa-organiser-event-details"
        style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(245,245,240,0.4)", transition: "color 0.3s ease" }}
      >
        {tr.organiserDetailPage.detailsLink}
        <ArrowIcon style={{ width: "14px", height: "14px" }} />
      </span>
    </Link>
  )
}

function TourStatusBadge({ status, tr }: { status: string; tr: Dictionary }) {
  // Reuses the exact status-pill chrome documented in
  // docs/afa-design-tokens-reference.md §5 (padding/fontSize/weight/
  // uppercase/letterSpacing) - minus its borderRadius: 999px, since that
  // rounded-pill treatment is the dashboard family's own convention
  // (same doc, §7) and this is a public directory page under the
  // sharp-corner rule everywhere else on it.
  const chrome: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "5px 10px",
    whiteSpace: "nowrap",
  }
  if (status === "LIVE") {
    return <span style={{ ...chrome, background: "rgba(201,151,58,0.15)", color: "var(--afa-amber)" }}>{tr.organiserDetailPage.tourStatusOnSale}</span>
  }
  return <span style={{ ...chrome, background: "rgba(245,245,240,0.08)", color: "var(--afa-text-primary)" }}>{tr.organiserDetailPage.tourStatusCompleted}</span>
}

function TourCard({ tour, tr }: { tour: OrganiserTour; tr: Dictionary }) {
  const cities = tourCities(tour.stops)
  const windowLabel = formatTourWindow(tour.stops)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", background: "var(--afa-surface-raised)", border: "1px solid rgba(245,245,240,0.1)", padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <RouteIcon style={{ width: "18px", height: "18px", color: "var(--afa-amber)", flexShrink: 0 }} />
          <h4 style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 500, lineHeight: 1.2, color: "var(--afa-text-primary)" }}>{tour.title}</h4>
        </div>
        <TourStatusBadge status={tour.status} tr={tr} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "32px" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--afa-amber)" }}>{tr.organiserDetailPage.tourStopsLabel}</div>
          <div style={{ marginTop: "6px", fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 500, color: "var(--afa-text-primary)" }}>
            {tr.organiserDetailPage.tourStopsTemplate.replace("{n}", String(tour.stops.length))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--afa-amber)" }}>{tr.organiserDetailPage.tourWindowLabel}</div>
          <div style={{ marginTop: "6px", fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 500, color: "var(--afa-text-primary)" }}>{windowLabel || "—"}</div>
        </div>
      </div>

      {cities.length > 0 && (
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--afa-amber)" }}>{tr.organiserDetailPage.tourCitiesLabel}</div>
          <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {cities.map((c) => (
              <span key={c} style={{ border: "1px solid rgba(245,245,240,0.1)", padding: "5px 10px", fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--afa-text-secondary)" }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function OrganiserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { t: tr } = useLocale()
  const [organiser, setOrganiser] = useState<OrganiserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [pastExpanded, setPastExpanded] = useState(false)

  useEffect(() => {
    fetch(`/api/organisers/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Organiser not found")
        return res.json()
      })
      .then(setOrganiser)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (<><SiteNav backHref="/events" backLabel={tr.organiserDetailPage.backToEvents} /><BrandLoader /></>)

  if (error || !organiser) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--afa-surface-page)" }}>
        <SiteNav backHref="/events" backLabel={tr.organiserDetailPage.backToEvents} />
        <div style={{ maxWidth: "1024px", margin: "0 auto", padding: "48px 24px", color: "var(--afa-text-primary)" }}>{tr.organiserDetailPage.notFound}</div>
      </main>
    )
  }

  const upcoming = organiser.events.filter((e) => !isPastEvent(e)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const past = organiser.events.filter((e) => isPastEvent(e)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const visiblePast = pastExpanded ? past : past.slice(0, PAST_EVENTS_PAGE_SIZE)
  const visibleTours = organiser.tours.slice(0, TOUR_DISPLAY_LIMIT)

  const initials = organiser.orgName.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
  const showAvatarPhoto = Boolean(organiser.user.avatar) && !isPlaceholderImageUrl(organiser.user.avatar)
  const memberSinceYear = new Date(organiser.createdAt).getFullYear()

  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-surface-page)" }}>
      <style>{`
        .afa-organiser-container { max-width: 1024px; margin: 0 auto; padding: 0 24px 112px; }
        @media (min-width: 640px) { .afa-organiser-container { padding: 0 40px 112px; } }
        .afa-organiser-avatar { width: 144px; height: 144px; }
        @media (min-width: 768px) { .afa-organiser-avatar { width: 176px; height: 176px; } }
        .afa-organiser-hero { display: grid; grid-template-columns: 1fr; gap: 40px; }
        @media (min-width: 768px) { .afa-organiser-hero { grid-template-columns: auto 1fr; align-items: start; gap: 48px; } }
        .afa-organiser-tours-grid { display: grid; grid-template-columns: 1fr; }
        @media (min-width: 768px) { .afa-organiser-tours-grid { grid-template-columns: 1fr 1fr; } }
        .afa-organiser-breadcrumb-link { transition: color 0.2s ease; }
        .afa-organiser-breadcrumb-link:hover { color: var(--afa-amber) !important; }
        .afa-organiser-event-card { border: 1px solid rgba(245,245,240,0.1); transition: border-color 0.3s ease; }
        .afa-organiser-event-card:hover { border-color: rgba(201,151,58,0.6); }
        .afa-organiser-event-card:hover .afa-organiser-event-title,
        .afa-organiser-event-card:hover .afa-organiser-event-details { color: var(--afa-amber); }
        .afa-organiser-view-all:hover { opacity: 0.8; }
      `}</style>

      <SiteNav backHref="/events" backLabel={tr.organiserDetailPage.backToEvents} />

      <div className="afa-organiser-container">
        <nav style={{ display: "flex", alignItems: "center", gap: "8px", padding: "32px 0", fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(245,245,240,0.4)" }}>
          <Link href="/events" className="afa-organiser-breadcrumb-link" style={{ color: "inherit", textDecoration: "none" }}>
            {tr.organiserDetailPage.breadcrumbEvents}
          </Link>
          <span>/</span>
          <Link href="/organisers" className="afa-organiser-breadcrumb-link" style={{ color: "inherit", textDecoration: "none" }}>
            {tr.organiserDetailPage.breadcrumbOrganisers}
          </Link>
          <span>/</span>
          <span style={{ color: "var(--afa-text-secondary)" }}>{tr.organiserDetailPage.breadcrumbProfile}</span>
        </nav>

        <header className="afa-organiser-hero" style={{ borderBottom: "1px solid rgba(245,245,240,0.1)", paddingBottom: "56px" }}>
          <div className="afa-organiser-avatar" style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--afa-surface-raised)", border: "1px solid rgba(245,245,240,0.1)", overflow: "hidden" }}>
            {showAvatarPhoto ? (
              <Photo src={organiser.user.avatar} alt={organiser.orgName} />
            ) : (
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "clamp(40px, 8vw, 64px)", letterSpacing: "-0.02em", color: "var(--afa-amber)" }}>{initials}</span>
            )}
          </div>

          <div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--afa-amber)" }}>
                {tr.organiserDetailPage.eyebrowOrganiser}
              </span>
              {organiser.code && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 500, letterSpacing: "0.12em", color: "rgba(245,245,240,0.4)" }}>{organiser.code}</span>
              )}
            </div>

            <h1 style={{ marginTop: "16px", fontFamily: "var(--font-display)", fontSize: "clamp(40px, 6vw, 72px)", fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 0.95, color: "var(--afa-text-primary)" }}>
              {organiser.orgName}
            </h1>

            {organiser.bio && (
              <p style={{ marginTop: "24px", maxWidth: "640px", fontSize: "17px", lineHeight: 1.6, color: "var(--afa-text-secondary)" }}>{organiser.bio}</p>
            )}

            <div style={{ marginTop: "32px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "24px" }}>
              <OrganiserFollowButton organiserId={organiser.id} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--afa-text-muted)" }}>
                {tr.organiserDetailPage.memberSinceTemplate.replace("{year}", String(memberSinceYear))}
              </span>
            </div>
          </div>
        </header>

        <section style={{ paddingTop: "64px" }}>
          <SectionHeader eyebrow={tr.organiserDetailPage.upcomingEventsHeading} count={upcoming.length} />
          <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {upcoming.length > 0 ? (
              upcoming.map((e) => <EventDateCard key={e.id} event={e} tr={tr} />)
            ) : (
              <EmptyState icon={<CalendarIcon style={{ width: "26px", height: "26px" }} />} title={tr.organiserDetailPage.noUpcomingTitle} body={tr.organiserDetailPage.noUpcomingBody} />
            )}
          </div>

          <div style={{ marginTop: "56px" }}>
            <SectionHeader eyebrow={tr.organiserDetailPage.pastEventsHeading} count={past.length} />
            <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "16px", opacity: past.length > 0 ? 0.85 : 1 }}>
              {past.length > 0 ? (
                visiblePast.map((e) => <EventDateCard key={e.id} event={e} tr={tr} />)
              ) : (
                <EmptyState icon={<CalendarIcon style={{ width: "26px", height: "26px" }} />} title={tr.organiserDetailPage.noPastTitle} body={tr.organiserDetailPage.noPastBody} />
              )}
            </div>
            {!pastExpanded && past.length > PAST_EVENTS_PAGE_SIZE && (
              <button
                onClick={() => setPastExpanded(true)}
                className="afa-organiser-view-all"
                style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--afa-amber)" }}
              >
                {tr.organiserDetailPage.viewAllPastTemplate.replace("{n}", String(past.length))}
                <ArrowIcon style={{ width: "14px", height: "14px" }} />
              </button>
            )}
          </div>
        </section>

        <section style={{ paddingTop: "64px" }}>
          <SectionHeader eyebrow={tr.organiserDetailPage.toursHeading} count={organiser.tours.length} />
          <div className="afa-organiser-tours-grid" style={{ marginTop: "24px", gap: "16px" }}>
            {visibleTours.length > 0 ? (
              visibleTours.map((t) => <TourCard key={t.id} tour={t} tr={tr} />)
            ) : (
              <div style={{ gridColumn: "1 / -1" }}>
                <EmptyState icon={<RouteIcon style={{ width: "26px", height: "26px" }} />} title={tr.organiserDetailPage.noToursTitle} body={tr.organiserDetailPage.noToursBody} />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
