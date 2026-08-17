"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Photo from "@/components/Photo"
import { type EventItem } from "@/components/EventCard"
import { useLocale } from "@/lib/i18n/translate"

const ROTATE_MS = 9000
const MAX_HERO_PHOTOS = 6

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onChange = () => setReduced(mq.matches)
    onChange()
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return reduced
}

/**
 * Full-bleed hero, per design.md "Four rooms, one house" (17 Aug) -
 * replaces the "Homepage V2" bento hero from PR #488 entirely. Crossfades
 * through real upcoming-show photography (not the Figma reference's
 * hardcoded Unsplash placeholders) via the shared Photo duotone
 * component, same /api/events call + "still showing tonight" cutoff the
 * "Happening Soon" bento section below already uses.
 */
export default function Hero() {
  const { t: tr } = useLocale()
  const reduced = usePrefersReducedMotion()
  const [photos, setPhotos] = useState<{ src: string; alt: string }[]>([])
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    fetch("/api/events")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: EventItem[]) => {
        const now = Date.now() - 24 * 60 * 60 * 1000
        const upcoming = data
          .filter((e) => e.posterImage && new Date(e.date).getTime() >= now)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(0, MAX_HERO_PHOTOS)
        setPhotos(upcoming.map((e) => ({ src: e.posterImage as string, alt: e.title })))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (reduced || paused || photos.length < 2) return
    const id = setInterval(() => setActive((a) => (a + 1) % photos.length), ROTATE_MS)
    return () => clearInterval(id)
  }, [reduced, paused, photos.length])

  return (
    <section
      style={{ position: "relative", minHeight: "100svh", width: "100%", overflow: "hidden", background: "var(--afa-surface-inverse)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        {photos.map((photo, i) => (
          <div key={photo.src} style={{ position: "absolute", inset: 0, opacity: i === active ? 1 : 0, transition: "opacity 1600ms ease-in-out" }}>
            <Photo src={photo.src} alt={photo.alt} />
          </div>
        ))}
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, var(--afa-surface-inverse) 5%, rgba(10,10,10,0.45) 45%, rgba(10,10,10,0.7) 100%)" }} />
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(10,10,10,0.85), rgba(10,10,10,0) 55%)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 2, maxWidth: "1400px", margin: "0 auto", display: "flex", flexDirection: "column", justifyContent: "flex-end", minHeight: "100svh", padding: "128px 24px 72px" }}>
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

        {photos.length > 1 && (
          <div style={{ marginTop: "56px", display: "flex", alignItems: "center", gap: "10px" }}>
            {photos.map((photo, i) => (
              <button
                key={photo.src}
                aria-label={`Photo ${i + 1} of ${photos.length}`}
                onClick={() => setActive(i)}
                style={{ position: "relative", height: "4px", width: i === active ? "40px" : "16px", borderRadius: "999px", overflow: "hidden", border: "none", padding: 0, cursor: "pointer", transition: "width 0.3s ease", background: "rgba(245,245,240,0.25)" }}
              >
                {i === active && !reduced && !paused && (
                  <span style={{ position: "absolute", inset: 0, background: "var(--afa-amber)", transformOrigin: "left", animation: `heroDrawLine ${ROTATE_MS}ms linear` }} />
                )}
                {i === active && (reduced || paused) && (
                  <span style={{ position: "absolute", inset: 0, background: "var(--afa-amber)" }} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes heroPing {
          75%, 100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes heroDrawLine {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
    </section>
  )
}
