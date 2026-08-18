"use client"

import Link from "next/link"
import SiteNav from "@/components/SiteNav"
import ArtistHero from "@/components/ArtistHero"
import Ledger from "@/components/Ledger"
import FaqAccordion from "@/components/FaqAccordion"
import { useLocale } from "@/lib/i18n/translate"

function JourneyStep({ n, title, detail }: { n: number; title: string; detail: string }) {
  return (
    <div style={{ display: "flex", gap: "24px", padding: "32px 0", borderBottom: "1px solid rgba(245,245,240,0.08)" }}>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "50%", border: "1px solid rgba(201,151,58,0.4)", fontFamily: "var(--font-mono)", fontSize: "16px", color: "var(--afa-amber)" }}>
        {n}
      </div>
      <div>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 600, color: "var(--afa-text-inverse)", margin: "0 0 8px" }}>
          {title}
        </h3>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "16px", lineHeight: 1.65, color: "rgba(245,245,240,0.75)", margin: 0, maxWidth: "560px" }}>
          {detail}
        </p>
      </div>
    </div>
  )
}

/**
 * Artist landing page ("The Stage"), GEN-2608-072, page 1 of 3 in the
 * role-landing-pages build (Artist / Organiser / Venue Owner - Artist
 * first per the agreed sequencing, one page fully built before the next
 * starts). Extends the homepage's Four Rooms teaser into a full
 * standalone page - no new Figma Make round, built directly against the
 * existing verified design system (palette, Photo.tsx, Ledger pattern,
 * FourRooms.tsx's numbered-step convention) and the real fourRoomsStage*
 * copy already shipped in en.ts, rather than inventing new voice.
 *
 * Proof section deliberately NOT built - deferred per design.md until
 * real platform aggregate data exists (no placeholder/fake stats, same
 * "no stock photos, all real data" principle as Four Rooms).
 */
export default function ForArtistsPage() {
  const { t: tr } = useLocale()

  const steps = [
    { title: tr.homePage.fourRoomsStageStep1, detail: tr.forArtistsPage.journeyStep1Detail },
    { title: tr.homePage.fourRoomsStageStep2, detail: tr.forArtistsPage.journeyStep2Detail },
    { title: tr.homePage.fourRoomsStageStep3, detail: tr.forArtistsPage.journeyStep3Detail },
    { title: tr.homePage.fourRoomsStageStep4, detail: tr.forArtistsPage.journeyStep4Detail },
  ]

  const faqs = [
    { q: tr.forArtistsPage.faqQ1, a: tr.forArtistsPage.faqA1 },
    { q: tr.forArtistsPage.faqQ2, a: tr.forArtistsPage.faqA2 },
    { q: tr.forArtistsPage.faqQ3, a: tr.forArtistsPage.faqA3 },
    { q: tr.forArtistsPage.faqQ4, a: tr.forArtistsPage.faqA4 },
  ]

  return (
    <main style={{ background: "var(--afa-surface-page)", color: "var(--afa-text-primary)", fontFamily: "var(--font-display)" }}>
      <SiteNav />

      <ArtistHero />

      {/* HONEST MONEY — expands the homepage's one-line promise into real
          payout detail, reusing the shared Ledger component (same stat
          cards/breakdown/tax disclaimer) rather than new stat markup. */}
      <section style={{ maxWidth: "1360px", margin: "0 auto", padding: "88px 36px 56px" }}>
        <Ledger eyebrow={tr.forArtistsPage.moneyEyebrow} headline={tr.forArtistsPage.moneyHeadline} />
        <p style={{ marginTop: "28px", maxWidth: "680px", fontFamily: "var(--font-sans)", fontSize: "16px", lineHeight: 1.7, color: "rgba(245,245,240,0.65)" }}>
          {tr.forArtistsPage.moneyPayoutTiming}
        </p>
      </section>

      {/* EXPANDED JOURNEY — same 4 steps as the homepage Four Rooms
          section, each given a real paragraph instead of a terse label.
          Numbered-circle treatment follows RoomRow's step-circle
          convention, adapted to a single vertical column since this page
          isn't alternating with other rooms. */}
      <section style={{ background: "var(--afa-surface-inverse)", borderTop: "1px solid rgba(245,245,240,0.08)" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto", padding: "88px 36px 40px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--afa-amber)", marginBottom: "16px" }}>
            {tr.forArtistsPage.journeyEyebrow}
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 500, color: "var(--afa-text-inverse)", margin: "0 0 40px" }}>
            {tr.forArtistsPage.journeyHeading}
          </h2>
          {steps.map((step, i) => (
            <JourneyStep key={step.title} n={i + 1} title={step.title} detail={step.detail} />
          ))}
        </div>
      </section>

      {/* FAQ — real, artist-specific questions (payout timing,
          verification, rate-setting, cancellation). Proof section
          deliberately omitted, see file-level comment. */}
      <section style={{ maxWidth: "760px", margin: "0 auto", padding: "88px 36px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--afa-amber)", marginBottom: "16px" }}>
          {tr.forArtistsPage.faqEyebrow}
        </div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 500, color: "var(--afa-text-primary)", margin: "0 0 32px" }}>
          {tr.forArtistsPage.faqHeading}
        </h2>
        <FaqAccordion items={faqs} />
      </section>

      {/* FINAL CTA — registration, role pre-selected. */}
      <section style={{ background: "var(--afa-surface-inverse)", borderTop: "1px solid rgba(245,245,240,0.08)", padding: "88px 36px", textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--afa-amber)", marginBottom: "16px" }}>
          {tr.forArtistsPage.finalCtaEyebrow}
        </div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 500, color: "var(--afa-text-inverse)", margin: "0 0 16px" }}>
          {tr.forArtistsPage.finalCtaHeading}
        </h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "17px", lineHeight: 1.6, color: "rgba(245,245,240,0.75)", maxWidth: "480px", margin: "0 auto 32px" }}>
          {tr.forArtistsPage.finalCtaSubtitle}
        </p>
        <Link
          href="/register?role=artist"
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--afa-fill-solid)", color: "var(--afa-on-fill-solid)", padding: "16px 32px", borderRadius: "999px", fontFamily: "var(--font-sans)", fontSize: "16px", fontWeight: 700, textDecoration: "none" }}
        >
          {tr.homePage.fourRoomsStageCta}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </section>
    </main>
  )
}
