"use client"

import Link from "next/link"
import PhotoCrossfadeBackdrop from "@/components/PhotoCrossfadeBackdrop"
import PhotoRotationDots from "@/components/PhotoRotationDots"
import { usePhotoRotation } from "@/hooks/usePhotoRotation"
import { useLocale } from "@/lib/i18n/translate"

/**
 * Hero for the Artist landing page ("The Stage", GEN-2608-072) - same
 * full-bleed crossfading-photo treatment as the homepage Hero, reusing
 * usePhotoRotation/PhotoCrossfadeBackdrop/PhotoRotationDots rather than
 * re-implementing the rotation/fade mechanics. Copy reuses the Four
 * Rooms name/promise/CTA already shipped in en.ts rather than inventing
 * new voice for this page.
 */
export default function ArtistHero() {
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

      <div style={{ position: "relative", zIndex: 2, maxWidth: "1400px", margin: "0 auto", display: "flex", flexDirection: "column", justifyContent: "flex-end", minHeight: "100svh", padding: "128px 24px 72px" }}>
        <div style={{ maxWidth: "760px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--afa-amber)", marginBottom: "24px" }}>
            {tr.homePage.fourRoomsStageName}
          </div>

          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4.4vw, 54px)", fontWeight: 500, lineHeight: 1.18, letterSpacing: "-0.01em", color: "var(--afa-text-primary)", margin: 0 }}>
            {tr.homePage.fourRoomsStagePromise}
          </h1>

          <div style={{ marginTop: "34px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px" }}>
            <Link href="/register?role=artist" style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--afa-fill-solid)", color: "var(--afa-on-fill-solid)", padding: "14px 28px", borderRadius: "999px", fontFamily: "var(--font-sans)", fontSize: "16px", fontWeight: 700, textDecoration: "none" }}>
              {tr.homePage.fourRoomsStageCta}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>

        <PhotoRotationDots photos={photos} active={active} setActive={setActive} paused={paused} reduced={reduced} />
      </div>
    </section>
  )
}
