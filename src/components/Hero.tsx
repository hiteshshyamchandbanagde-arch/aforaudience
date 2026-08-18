"use client"

import Link from "next/link"
import PhotoCrossfadeBackdrop from "@/components/PhotoCrossfadeBackdrop"
import PhotoRotationDots from "@/components/PhotoRotationDots"
import { usePhotoRotation } from "@/hooks/usePhotoRotation"
import { useLocale } from "@/lib/i18n/translate"

/**
 * Full-bleed hero, per design.md "Four rooms, one house" (17 Aug) -
 * replaces the "Homepage V2" bento hero from PR #488 entirely. Crossfades
 * through real upcoming-show photography (not the Figma reference's
 * hardcoded Unsplash placeholders) via the shared Photo duotone
 * component. Rotation/fetch/pause logic lives in usePhotoRotation
 * (extracted GEN-2608-072) so the Artist landing page's hero reuses it
 * instead of duplicating the crossfade mechanics.
 */
export default function Hero() {
  const { t: tr } = useLocale()
  const { photos, active, setActive, paused, setPaused, reduced } = usePhotoRotation()

  return (
    <section
      style={{ position: "relative", minHeight: "100svh", width: "100%", overflow: "hidden", background: "var(--afa-surface-inverse)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <PhotoCrossfadeBackdrop photos={photos} active={active} />

      <div style={{ position: "relative", zIndex: 2, maxWidth: "1400px", margin: "0 auto", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100svh", padding: "128px 24px 72px" }}>
        <div style={{ maxWidth: "760px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <span style={{ position: "relative", display: "flex", width: "8px", height: "8px" }}>
              <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--afa-fill-solid)", opacity: 0.75, animation: reduced ? "none" : "heroPing 1.8s cubic-bezier(0,0,0.2,1) infinite" }} />
              <span style={{ position: "relative", width: "8px", height: "8px", borderRadius: "50%", background: "var(--afa-fill-solid)" }} />
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--afa-amber)" }}>
              {tr.homePage.heroIssueTag}
            </span>
          </div>

          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(40px, 8vw, 104px)", fontWeight: 500, lineHeight: 0.94, letterSpacing: "-0.02em", color: "var(--afa-text-primary)", margin: 0 }}>
            {tr.homePage.heroLine1Prefix}{tr.homePage.heroLine1Emphasis}<br />
            {tr.homePage.heroLine2}<em style={{ fontStyle: "italic", fontWeight: 500, color: "var(--afa-amber)" }}>{tr.homePage.heroLine3}</em>
          </h1>

          <p style={{ marginTop: "26px", maxWidth: "560px", fontFamily: "var(--font-sans)", fontSize: "18px", lineHeight: 1.65, color: "var(--afa-text-primary)", opacity: 0.75 }}>
            {tr.homePage.heroSubtitle}
          </p>

          <div style={{ marginTop: "34px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px" }}>
            <Link href="/events" style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--afa-fill-solid)", color: "var(--afa-on-fill-solid)", padding: "14px 28px", borderRadius: "999px", fontFamily: "var(--font-sans)", fontSize: "16px", fontWeight: 700, textDecoration: "none" }}>
              {tr.homePage.ctaFindTonightsShow}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link href="/profile" style={{ display: "inline-flex", alignItems: "center", color: "var(--afa-text-primary)", padding: "14px 28px", borderRadius: "999px", border: "1.5px solid rgba(245,245,240,0.25)", fontFamily: "var(--font-sans)", fontSize: "16px", fontWeight: 500, textDecoration: "none" }}>
              {tr.homePage.ctaImArtist}
            </Link>
          </div>
        </div>

        <PhotoRotationDots photos={photos} active={active} setActive={setActive} paused={paused} reduced={reduced} />
      </div>

      <style>{`
        @keyframes heroPing {
          75%, 100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>
    </section>
  )
}
