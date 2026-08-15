"use client"
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import NearYouTabs from "@/components/NearYouTabs";
import HeroRotator from "@/components/HeroRotator";
import HowItWorksSection from "@/components/HowItWorksSection";
import RolesSection from "@/components/RolesSection";
import PlatformGrowthStrip from "@/components/PlatformGrowthStrip";
import { useLocale } from "@/lib/i18n/translate";

export default function Home() {
  const { t: tr } = useLocale()
  const TICKER_UNIQUE_ITEMS = [tr.homePage.tickerOpenMicMumbai, tr.homePage.tickerPoetryDelhi, tr.homePage.tickerStandUpBangalore, tr.homePage.tickerTheaterPune, tr.homePage.tickerOpenMicHyderabad, tr.homePage.tickerComedyChennai, tr.homePage.tickerSpokenWordKolkata]
  const tickerItems = [...TICKER_UNIQUE_ITEMS, ...TICKER_UNIQUE_ITEMS]
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
              {tr.homePage.heroLine1Prefix}{tr.homePage.heroLine1Emphasis}<br />{tr.homePage.heroLine2}<br /><em style={{ fontStyle: "italic", fontWeight: 500, color: "var(--afa-terracotta)" }}>{tr.homePage.heroLine3}</em>
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