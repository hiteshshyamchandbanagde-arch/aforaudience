"use client"
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import TonightNearYou from "@/components/TonightNearYou";
import MoodThemeSection from "@/components/MoodThemeSection";
import { useLocale } from "@/lib/i18n/translate";

export default function Home() {
  const { t: tr } = useLocale()
  const TICKER_UNIQUE_ITEMS = [tr.homePage.tickerOpenMicMumbai, tr.homePage.tickerPoetryDelhi, tr.homePage.tickerStandUpBangalore, tr.homePage.tickerTheaterPune, tr.homePage.tickerOpenMicHyderabad, tr.homePage.tickerComedyChennai, tr.homePage.tickerSpokenWordKolkata]
  const tickerItems = [...TICKER_UNIQUE_ITEMS, ...TICKER_UNIQUE_ITEMS]
  return (
    <main className="min-h-screen" style={{ background: "var(--afa-cream)", color: "var(--afa-ink)", fontFamily: "var(--font-display)" }}>

      <SiteNav variant="home" />

      {/* HERO — Editorial Split. Resumes BUG-2607-036 (HIGH: "generic/
          templated" look) + FEAT-2607-028 (platform-wide visual pass) +
          FEAT-2608-030 (homepage first, per Hitesh's sequencing). Asymmetric
          two-column magazine-spread layout instead of a centered hero+CTA+
          stats stack — oversized headline bleeding left, live "Tonight,
          near you" data rail right (real upcoming events, not a static
          image/video slot). Real CTA buttons kept (not the pure inline-text
          links from the design mock) — conversion clarity for Explore
          Events / I'm an Artist matters more than strict editorial purity
          here. Columns use flexWrap (matches the rest of this file's
          responsive approach) so they naturally stack on narrow screens:
          headline column first, rail second - no separate mobile layout
          needed. */}
      <section style={{ padding: "0", position: "relative" }}>
        {/* Subtle grain overlay - self-contained inline SVG noise, no
            asset/network dependency. Flat color fields (even good ones)
            read as "digital default" without any texture; a faint grain
            is one of the cheapest ways to add tactile depth. Kept very
            low-opacity so it's felt, not seen. */}
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: 0.035, pointerEvents: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", mixBlendMode: "multiply" }} />
        <div style={{ maxWidth: "1360px", margin: "0 auto", display: "flex", alignItems: "stretch", flexWrap: "wrap" }}>
          <div className="hero-fade-1" style={{ flex: "1.15 1 480px", padding: "72px 48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.12em", color: "var(--afa-gold, #8A5A1E)", textTransform: "uppercase", marginBottom: "22px" }}>
              {tr.homePage.heroIssueTag}
            </div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(46px, 7vw, 88px)", fontWeight: 700, lineHeight: 0.96, letterSpacing: "-1.5px", color: "var(--afa-ink)", marginBottom: "10px" }}>
              {tr.homePage.heroLine1Prefix}{tr.homePage.heroLine1Emphasis}<br />{tr.homePage.heroLine2}<br /><em style={{ fontStyle: "italic", fontWeight: 500, color: "var(--afa-terracotta)" }}>{tr.homePage.heroLine3}</em>
            </h1>
            <p style={{ fontSize: "15px", color: "var(--afa-ink)", opacity: 0.65, maxWidth: "400px", lineHeight: 1.7, margin: "26px 0", paddingLeft: "18px", borderLeft: "3px solid var(--afa-terracotta)", fontFamily: "var(--font-sans)" }}>
              {tr.homePage.heroSubtitle}
            </p>
            <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
              <Link href="/events" style={{ background: "var(--afa-ink)", color: "var(--afa-cream)", padding: "15px 32px", borderRadius: "6px", fontSize: "14px", fontWeight: 700, textDecoration: "none", fontFamily: "var(--font-sans)" }}>
                {tr.homePage.ctaExploreEvents}
              </Link>
              <Link href="/profile" style={{ background: "transparent", color: "var(--afa-ink)", padding: "15px 32px", borderRadius: "6px", fontSize: "14px", fontWeight: 500, textDecoration: "none", border: "1.5px solid rgba(14,12,10,0.2)", fontFamily: "var(--font-sans)" }}>
                {tr.homePage.ctaImArtist}
              </Link>
            </div>
          </div>

          <div className="hero-fade-2" style={{ flex: "0.85 1 360px", padding: "48px 32px", display: "flex", alignItems: "center" }}>
            <TonightNearYou />
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div style={{ background: "var(--afa-ink)", color: "var(--afa-cream)", padding: "14px 0", overflow: "hidden", borderTop: "2px solid var(--afa-terracotta)" }}>
        <div style={{ display: "flex", gap: "0", whiteSpace: "nowrap", animation: "ticker 28s linear infinite", willChange: "transform", backfaceVisibility: "hidden" }}>
          {tickerItems.map((item, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "16px", padding: "0 32px", fontFamily: "var(--font-mono)", fontSize: "13px" }}>
              <span style={{ color: "var(--afa-terracotta)" }}>◆</span> {item}
            </span>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section style={{ padding: "100px 48px", background: "white" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--afa-terracotta)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "24px", height: "1px", background: "var(--afa-terracotta)", display: "inline-block" }}></span>
          {tr.homePage.howItWorksEyebrow}
        </div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(32px, 3.5vw, 52px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-1px", color: "var(--afa-ink)", marginBottom: "56px" }}>
          {tr.homePage.howItWorksHeadingPrefix}<br /><em style={{ color: "var(--afa-terracotta)" }}>{tr.homePage.howItWorksHeadingEmphasis}</em>
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "2px" }}>
          {[
            { num: "01", icon: "🔍", title: tr.homePage.stepDiscoverTitle, desc: tr.homePage.stepDiscoverDesc },
            { num: "02", icon: "🎟️", title: tr.homePage.stepBookTitle, desc: tr.homePage.stepBookDesc },
            { num: "03", icon: "📲", title: tr.homePage.stepTicketTitle, desc: tr.homePage.stepTicketDesc },
            { num: "04", icon: "⭐", title: tr.homePage.stepRateTitle, desc: tr.homePage.stepRateDesc },
          ].map((step) => (
            <div key={step.num} style={{ background: "var(--afa-cream)", padding: "40px 32px" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "72px", fontWeight: 800, color: "var(--afa-terracotta)", opacity: 0.12, lineHeight: 1, marginBottom: "20px", letterSpacing: "-3px" }}>{step.num}</div>
              <div style={{ fontSize: "36px", marginBottom: "16px" }}>{step.icon}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "10px" }}>{step.title}</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--afa-ink)", opacity: 0.6, lineHeight: 1.6 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ROLES */}
      <section style={{ padding: "100px 48px", background: "var(--afa-cream)" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--afa-terracotta)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "24px", height: "1px", background: "var(--afa-terracotta)", display: "inline-block" }}></span>
          {tr.homePage.rolesEyebrow}
        </div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(32px, 3.5vw, 52px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-1px", color: "var(--afa-ink)", marginBottom: "16px" }}>
          {tr.homePage.rolesHeadingLine1}<br /><em style={{ color: "var(--afa-terracotta)" }}>{tr.homePage.rolesHeadingLine2Emphasis}</em>
        </h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "17px", fontWeight: 300, color: "var(--afa-ink)", opacity: 0.6, maxWidth: "560px", lineHeight: 1.7, marginBottom: "56px" }}>
          {tr.homePage.rolesSubtitle}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          {[
            {
              icon: "👥", name: tr.roles.AUDIENCE, tag: tr.homePage.audienceTag,
              pitch: tr.homePage.audiencePitch,
              benefits: [tr.homePage.audienceBenefit1, tr.homePage.audienceBenefit2, tr.homePage.audienceBenefit3],
              cta: tr.homePage.audienceCta, href: "/events",
            },
            {
              icon: "🎤", name: tr.roles.ARTIST, tag: tr.homePage.artistTag,
              pitch: tr.homePage.artistPitch,
              benefits: [tr.homePage.artistBenefit1, tr.homePage.artistBenefit2, tr.homePage.artistBenefit3],
              cta: tr.homePage.artistCta, href: "/profile",
            },
            {
              icon: "🎪", name: tr.roles.ORGANISER, tag: tr.homePage.organiserTag,
              pitch: tr.homePage.organiserPitch,
              benefits: [tr.homePage.organiserBenefit1, tr.homePage.organiserBenefit2, tr.homePage.organiserBenefit3],
              cta: tr.homePage.organiserCta, href: "/profile",
            },
            {
              icon: "🏛️", name: tr.roles.VENUE_OWNER, tag: tr.homePage.venueOwnerTag,
              pitch: tr.homePage.venueOwnerPitch,
              benefits: [tr.homePage.venueOwnerBenefit1, tr.homePage.venueOwnerBenefit2, tr.homePage.venueOwnerBenefit3],
              cta: tr.homePage.venueOwnerCta, href: "/profile",
            },
          ].map((role) => (
            <div key={role.name} style={{ border: "1.5px solid rgba(14,12,10,0.1)", borderRadius: "12px", padding: "32px 28px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "36px", marginBottom: "16px" }}>{role.icon}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "19px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "4px" }}>{role.name}</div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", padding: "3px 9px", borderRadius: "4px", background: "var(--afa-mist)", color: "var(--afa-ink)", opacity: 0.7, alignSelf: "flex-start", marginBottom: "16px" }}>{role.tag}</span>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "15px", fontStyle: "italic", color: "var(--afa-terracotta)", lineHeight: 1.5, marginBottom: "18px" }}>{role.pitch}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
                {role.benefits.map((b) => (
                  <li key={b} style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--afa-ink)", opacity: 0.65, lineHeight: 1.5, display: "flex", gap: "8px" }}>
                    <span style={{ color: "var(--afa-terracotta)", flexShrink: 0 }}>✓</span>{b}
                  </li>
                ))}
              </ul>
              <Link href={role.href} style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600, color: "var(--afa-terracotta)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                {role.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <MoodThemeSection />

      {/* FOOTER */}
      <footer style={{ background: "var(--afa-ink)", color: "var(--afa-cream)", padding: "64px 48px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "48px", marginBottom: "48px" }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700, color: "var(--afa-cream)", marginBottom: "12px" }}>
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
        .hero-fade-1, .hero-fade-2 {
          animation: heroFadeUp 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .hero-fade-2 { animation-delay: 120ms; }
        @media (prefers-reduced-motion: reduce) {
          .hero-fade-1, .hero-fade-2 { animation: none; }
        }
      `}</style>
    </main>
  );
}