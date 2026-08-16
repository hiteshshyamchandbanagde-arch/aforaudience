"use client"
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import NearYouTabs from "@/components/NearYouTabs";
import HeroRotator from "@/components/HeroRotator";
import HowItWorksSection from "@/components/HowItWorksSection";
import RolesSection from "@/components/RolesSection";
import PlatformGrowthStrip from "@/components/PlatformGrowthStrip";
import { TYPE_META, LineupChips, type EventItem } from "@/components/EventCard";
import Photo from "@/components/Photo";
import { useLocale } from "@/lib/i18n/translate";

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
      {event.posterImage ? <Photo src={event.posterImage} alt={event.title} /> : (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "72px" }}>{meta.emoji}</div>
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

function FeeRow({ label, value, accent, muted, bold }: { label: string; value: string; accent?: boolean; muted?: boolean; bold?: boolean }) {
  const color = accent ? "var(--afa-fill-solid)" : muted ? "rgba(245,245,240,0.5)" : "var(--afa-text-primary)"
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "24px", padding: "4px 0" }}>
      <span style={{ color: "rgba(245,245,240,0.6)" }}>{label}</span>
      <span style={{ color, fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  )
}

export default function Home() {
  const { t: tr } = useLocale()
  const TICKER_UNIQUE_ITEMS = [tr.homePage.tickerOpenMicMumbai, tr.homePage.tickerPoetryDelhi, tr.homePage.tickerStandUpBangalore, tr.homePage.tickerTheaterPune, tr.homePage.tickerOpenMicHyderabad, tr.homePage.tickerComedyChennai, tr.homePage.tickerSpokenWordKolkata]
  const tickerItems = [...TICKER_UNIQUE_ITEMS, ...TICKER_UNIQUE_ITEMS]

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

      <SiteNav variant="home" />

      {/* HERO — Editorial Split, 3-up: headline + NearYouTabs + HeroRotator.
          Third iteration this session (GEN-2608-032): started as headline +
          TonightNearYou + static HeroRotator (PR #396/#400) -> swapped
          HeroRotator for a data-driven ArtistsNearYou card (#405/#407/#408)
          -> Hitesh then asked for events+artists combined into ONE panel
          (this change), so TonightNearYou and ArtistsNearYou merged into
          NearYouTabs (tabbed, full list per tab, not trimmed) and
          HeroRotator moved back into the 3rd column as the visual media
          showcase it always was - that's what "your performance, featured
          here" actually meant (photos/video, not a text CTA - corrected
          mid-session after initially misreading it as a link).
          TonightNearYou.tsx and ArtistsNearYou.tsx left unused in the repo
          rather than deleted, same as HeroRotator was earlier. */}
      <section style={{ padding: "64px 0 0", position: "relative" }}>
        {/* Subtle grain overlay - self-contained inline SVG noise, no
            asset/network dependency. Flat color fields (even good ones)
            read as "digital default" without any texture; a faint grain
            is one of the cheapest ways to add tactile depth. Kept very
            low-opacity so it's felt, not seen. */}
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: 0.035, pointerEvents: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", mixBlendMode: "multiply" }} />
        <div style={{ maxWidth: "1360px", margin: "0 auto", display: "flex", alignItems: "stretch", flexWrap: "wrap" }}>
          <div className="hero-fade-1" style={{ flex: "1.3 1 380px", padding: "40px 36px 56px", display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700, letterSpacing: "0.12em", color: "var(--afa-gold, #8A5A1E)", textTransform: "uppercase", marginBottom: "20px" }}>
              {tr.homePage.heroIssueTag}
            </div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(32px, 4.4vw, 60px)", fontWeight: 700, lineHeight: 0.98, letterSpacing: "-1px", color: "var(--afa-text-primary)", marginBottom: "10px" }}>
              {tr.homePage.heroLine1Prefix}{tr.homePage.heroLine1Emphasis}<br />{tr.homePage.heroLine2}<em style={{ fontStyle: "italic", fontWeight: 500, color: "var(--afa-fill-solid)" }}>{tr.homePage.heroLine3}</em>
            </h1>
            <p style={{ fontSize: "14px", color: "var(--afa-text-primary)", opacity: 0.65, maxWidth: "340px", lineHeight: 1.65, margin: "22px 0", paddingLeft: "16px", borderLeft: "3px solid var(--afa-terracotta)", fontFamily: "var(--font-sans)" }}>
              {tr.homePage.heroSubtitle}
            </p>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <Link href="/events" style={{ background: "var(--afa-fill-solid)", color: "var(--afa-on-fill-solid)", padding: "14px 26px", borderRadius: "6px", fontSize: "14px", fontWeight: 700, textDecoration: "none", fontFamily: "var(--font-sans)" }}>
                {tr.homePage.ctaExploreEvents}
              </Link>
              <Link href="/profile" style={{ background: "transparent", color: "var(--afa-text-primary)", padding: "14px 26px", borderRadius: "6px", fontSize: "14px", fontWeight: 500, textDecoration: "none", border: "1.5px solid rgba(245,245,240,0.2)", fontFamily: "var(--font-sans)" }}>
                {tr.homePage.ctaImArtist}
              </Link>
            </div>
          </div>

          <div className="hero-fade-2" style={{ flex: "0.9 1 300px", padding: "40px 20px", display: "flex", alignItems: "stretch" }}>
            <NearYouTabs />
          </div>

          <div className="hero-fade-3" style={{ flex: "0.9 1 300px", padding: "40px 20px" }}>
            <HeroRotator />
          </div>
        </div>
      </section>

      {/* HAPPENING SOON — bento mosaic (V2 spec) */}
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

      {/* ZERO-COMMISSION PROMISE (V2 spec) */}
      <section style={{ maxWidth: "1360px", margin: "0 auto", padding: "0 36px 56px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "32px", alignItems: "center", background: "var(--afa-surface-raised)", borderRadius: "16px", padding: "36px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--afa-amber)", marginBottom: "12px" }}>
              {tr.homePage.feePromiseEyebrow}
            </div>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "22px", lineHeight: 1.35, color: "var(--afa-text-primary)", margin: 0 }}>
              {tr.homePage.feePromiseHeadline}
            </p>
            <div style={{ display: "flex", gap: "32px", marginTop: "24px" }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "32px", color: "var(--afa-fill-solid)" }}>0%</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(245,245,240,0.6)" }}>{tr.homePage.feeCommissionLabel}</div>
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "32px", color: "var(--afa-fill-solid)" }}>0%</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(245,245,240,0.6)" }}>{tr.homePage.feeHiddenFeesLabel}</div>
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "32px", color: "var(--afa-fill-solid)" }}>100%</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(245,245,240,0.6)" }}>{tr.homePage.feeArtistVenueShareLabel}</div>
              </div>
            </div>
          </div>
          <div style={{ background: "var(--afa-surface-inverse)", borderRadius: "12px", padding: "20px", fontFamily: "var(--font-mono)", fontSize: "13px" }}>
            <FeeRow label={tr.homePage.feeBaseLabel} value="₹500" />
            <FeeRow label={tr.homePage.feeArtistVenueShareLabel} value="100%" accent />
            <FeeRow label={tr.homePage.feeCommissionLabel} value="₹0" accent />
            <div style={{ height: "1px", background: "rgba(245,245,240,0.1)", margin: "10px 0" }} />
            <FeeRow label={tr.homePage.feeBookingFeeLabel} value="₹30" muted />
            <FeeRow label={tr.homePage.feeYouPayLabel} value="₹530" bold />
          </div>
        </div>
      </section>

      <PlatformGrowthStrip />

      {/* TICKER */}
      <div style={{ background: "var(--afa-surface-inverse)", color: "var(--afa-text-inverse)", padding: "14px 0", overflow: "hidden", borderTop: "2px solid var(--afa-terracotta)" }}>
        <div style={{ display: "flex", gap: "0", whiteSpace: "nowrap", animation: "ticker 28s linear infinite", willChange: "transform", backfaceVisibility: "hidden" }}>
          {tickerItems.map((item, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "16px", padding: "0 32px", fontFamily: "var(--font-mono)", fontSize: "13px" }}>
              <span style={{ color: "var(--afa-terracotta)" }}>◆</span> {item}
            </span>
          ))}
        </div>
      </div>

      <HowItWorksSection />

      <RolesSection />


      {/* FOOTER */}
      <footer style={{ background: "var(--afa-surface-inverse)", color: "var(--afa-text-inverse)", padding: "64px 48px 32px" }}>
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
      </footer>

      <style>{`
        @keyframes ticker {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hero-fade-1, .hero-fade-2, .hero-fade-3 {
          animation: heroFadeUp 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .hero-fade-2 { animation-delay: 120ms; }
        .hero-fade-3 { animation-delay: 220ms; }
        @media (prefers-reduced-motion: reduce) {
          .hero-fade-1, .hero-fade-2, .hero-fade-3 { animation: none; }
        }
      `}</style>
    </main>
  );
}