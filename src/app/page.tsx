"use client"
import { useEffect, useState } from "react";
import Link from "next/link";
import HomeHeader from "@/components/HomeHeader";
import Hero from "@/components/Hero";
import FourRooms from "@/components/FourRooms";
import PlatformGrowthStrip from "@/components/PlatformGrowthStrip";
import Ledger from "@/components/Ledger";
import { TYPE_META, LineupChips, type EventItem } from "@/components/EventCard";
import Photo from "@/components/Photo";
import { useLocale } from "@/lib/i18n/translate";

// Real Unsplash photos (Unsplash License, verified per-photo - see
// public/images/event-fallbacks/ for the source IDs) standing in for a
// no-posterImage event, one per type. Downloaded rather than hotlinked
// (BUG-2608-079's failure mode) and sized at 2600px wide so a single
// fixed <img> (Photo.tsx has no srcset) still covers the largest bento
// slot's actual rendered size at 2x DPR - the "strip" tile is ~1288px
// CSS-wide, so it needs ~2576px at retina; see the other two sizes'
// math below in BentoTile. Rendered through the same Photo component
// (and its already-correct grayscale+contrast+brightness+amber-multiply
// duotone) real posters use - this is a source swap, not a new visual
// treatment. Homepage-only: EventCard.tsx's IllustratedEventFallback
// (events listing/detail hero) is untouched.
const EVENT_FALLBACK_PHOTOS: Record<string, string> = {
  OPEN_MIC: "/images/event-fallbacks/open-mic.jpg",
  STAND_UP: "/images/event-fallbacks/stand-up.jpg",
  POETRY: "/images/event-fallbacks/poetry.jpg",
  THEATER: "/images/event-fallbacks/theater.jpg",
  LINEUP: "/images/event-fallbacks/lineup.jpg",
}

// "Happening soon" bento tile - 3 size variants (large/medium/strip), per
// the V2 spec's bento mosaic layout. Distinct from the events-listing
// EventCard (full-bleed poster style vs. badge card), but reuses the same
// EventItem shape, TYPE_META fallback tile, Photo duotone, and
// LineupChips - no need to duplicate that data/visual logic a third time.
function BentoTile({ event, size }: { event: EventItem; size: "large" | "medium" | "strip" }) {
  const { t: tr } = useLocale()
  const meta = TYPE_META[event.type] || TYPE_META.OPEN_MIC
  const typeKey = (event.type in TYPE_META ? event.type : "OPEN_MIC") as keyof typeof tr.eventTypes
  const typeLabel = tr.eventTypes[typeKey]
  const height = size === "large" ? "440px" : size === "medium" ? "210px" : "220px";
  const titleSize = size === "large" ? "28px" : size === "strip" ? "24px" : "18px";
  // BUG-2608-079 - a dead posterImage URL previously left Photo rendering
  // a broken <img>. Falls back to this tile's stock-photo state below,
  // not a new pattern.
  const [photoFailed, setPhotoFailed] = useState(false)
  const usingFallbackPhoto = !event.posterImage || photoFailed
  const fallbackPhoto = EVENT_FALLBACK_PHOTOS[event.type] || EVENT_FALLBACK_PHOTOS.OPEN_MIC

  return (
    <Link
      href={`/events/${event.id}`}
      style={{
        position: "relative",
        display: "block",
        height,
        borderRadius: "16px",
        overflow: "hidden",
        background: meta.color,
        textDecoration: "none",
      }}
    >
      {!usingFallbackPhoto ? (
        <Photo src={event.posterImage} alt={event.title} onError={() => setPhotoFailed(true)} />
      ) : (
        // Real photo (Unsplash, licensed - see EVENT_FALLBACK_PHOTOS above),
        // not an illustration - reuses Photo's existing duotone treatment
        // rather than a bespoke one so it reads identically to a real
        // poster. The "Illustrative" chip below is what keeps it from
        // being mistaken for this specific event's actual photo.
        <Photo src={fallbackPhoto} alt={typeLabel} />
      )}
      {usingFallbackPhoto && (
        <span
          style={{
            position: "absolute",
            left: size === "strip" ? "28px" : "20px",
            top: "16px",
            display: "inline-flex",
            background: "rgba(10,10,10,0.7)",
            backdropFilter: "blur(4px)",
            padding: "5px 9px",
            borderRadius: "2px",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--afa-amber)",
          }}
        >
          {tr.homePage.bentoIllustrativeLabel}
        </span>
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,10,10,0) 40%, rgba(10,10,10,0.88) 100%)" }} />
      <div style={{ position: "absolute", left: size === "strip" ? "28px" : "20px", right: "20px", bottom: "20px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--afa-amber)", marginBottom: "8px" }}>
          {typeLabel} · {event.venue ? event.venue.city : tr.eventsPage.venueTBD}
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: titleSize, lineHeight: 1.05, letterSpacing: "-0.02em", color: "var(--afa-text-primary)", marginBottom: "10px" }}>
          {event.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <LineupChips lineup={event.lineup} size={24} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "rgba(245,245,240,0.75)" }}>
            {event.isFree ? tr.eventsPage.freeBadge : event.ticketPrice ? `from ₹${event.ticketPrice}` : "—"}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function Home() {
  const { t: tr } = useLocale()

  // "Happening soon" bento mosaic (V2 spec) - top 4 upcoming events across
  // all cities. Same /api/events call the events listing page already
  // makes; this is a lightweight homepage teaser, not the full
  // filter/sort/pagination experience that page owns.
  const [bentoEvents, setBentoEvents] = useState<EventItem[]>([])
  useEffect(() => {
    fetch("/api/events")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: EventItem[]) => {
        const now = Date.now() - 24 * 60 * 60 * 1000
        setBentoEvents(data.filter((e) => new Date(e.date).getTime() >= now).slice(0, 4))
      })
      .catch(() => {})
  }, [])

  return (
    <main className="min-h-screen" style={{ background: "var(--afa-surface-page)", color: "var(--afa-text-primary)", fontFamily: "var(--font-display)" }}>

      <HomeHeader />

      <Hero />

      {/* HAPPENING SOON — bento mosaic (V2 spec). Sits directly below the
          "Four rooms, one house" hero (design.md, 17 Aug) now instead of
          the bento hero it used to pair with visually - kept in place per
          brief (out of scope to redesign here), may read as a slightly
          disconnected transition until it's folded into a later pass. */}
      {bentoEvents.length > 0 && (
        <section style={{ maxWidth: "1360px", margin: "0 auto", padding: "24px 36px 56px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "20px" }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--afa-amber)", marginBottom: "8px" }}>
                {tr.homePage.happeningSoonEyebrow}
              </div>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "28px", color: "var(--afa-text-primary)" }}>
                {tr.homePage.happeningSoonTitle}
              </h2>
            </div>
            <Link href="/events" style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--afa-amber)", textDecoration: "none" }}>
              {tr.homePage.happeningSoonAll}
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: bentoEvents.length > 1 ? "3fr 2fr" : "1fr", gap: "12px" }}>
            <BentoTile event={bentoEvents[0]} size="large" />
            {bentoEvents.length > 1 && (
              <div style={{ display: "grid", gap: "12px" }}>
                {bentoEvents[1] && <BentoTile event={bentoEvents[1]} size="medium" />}
                {bentoEvents[2] && <BentoTile event={bentoEvents[2]} size="medium" />}
              </div>
            )}
          </div>
          {bentoEvents[3] && (
            <div style={{ marginTop: "12px" }}>
              <BentoTile event={bentoEvents[3]} size="strip" />
            </div>
          )}
        </section>
      )}

      {/* ZERO-COMMISSION PROMISE (V2 spec) - Ledger extracted to
          src/components/Ledger.tsx (GEN-2608-072) so the Artist landing
          page's expanded "honest money" section reuses the same stat
          cards/breakdown/disclaimer instead of a parallel copy. */}
      <section style={{ maxWidth: "1360px", margin: "0 auto", padding: "0 36px 56px" }}>
        <Ledger eyebrow={tr.homePage.feePromiseEyebrow} headline={tr.homePage.feePromiseHeadline} />
      </section>

      <FourRooms />

      <PlatformGrowthStrip />

      {/* FOOTER */}
      <footer style={{ background: "var(--afa-surface-inverse)", color: "var(--afa-text-inverse)", padding: "64px 48px 32px" }}>
        <div style={{ maxWidth: "1360px", margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "48px", marginBottom: "48px" }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700, color: "var(--afa-text-inverse)", marginBottom: "12px" }}>
                <span style={{ color: "var(--afa-brand-mark)" }}>A</span>forAudience
              </div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "rgba(247,243,238,0.45)", lineHeight: 1.65, maxWidth: "280px" }}>
                {tr.homePage.footerTagline}
              </p>
            </div>
            {[
              {
                title: tr.homePage.footerColPlatform,
                links: [
                  { label: tr.homePage.footerBrowseEvents, href: "/events" },
                  { label: tr.homePage.footerFindArtists, href: "/artists" },
                  { label: tr.homePage.footerExploreVenues, href: "/venues" },
                  { label: tr.homePage.footerLivestreams, href: "/livestreams" },
                ],
              },
              {
                title: tr.homePage.footerColJoinAs,
                links: [
                  { label: tr.roles.ARTIST, href: "/register?role=artist" },
                  { label: tr.roles.ORGANISER, href: "/register?role=organiser" },
                  { label: tr.roles.VENUE_OWNER, href: "/register?role=venue" },
                  { label: tr.roles.AUDIENCE, href: "/register" },
                ],
              },
              {
                title: tr.homePage.footerColCompany,
                links: [
                  { label: tr.homePage.footerAboutUs, href: "/about" },
                  { label: tr.homePage.footerBlog, href: "/blog" },
                  { label: tr.homePage.footerCareers, href: "/careers" },
                  { label: tr.homePage.footerPrivacyPolicy, href: "/privacy" },
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--afa-amber)", marginBottom: "20px" }}>{col.title}</div>
                <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                  {col.links.map((link) => (
                    <li key={link.label}><Link href={link.href} style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "rgba(247,243,238,0.5)", textDecoration: "none" }}>{link.label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "32px", borderTop: "1px solid rgba(255,255,255,0.08)", fontFamily: "var(--font-sans)", fontSize: "13px", color: "rgba(247,243,238,0.3)", flexWrap: "wrap", gap: "8px" }}>
            <span>{tr.homePage.footerCopyright}</span>
            <span>{tr.homePage.footerMadeWith}</span>
          </div>
        </div>
      </footer>
    </main>
  );
}