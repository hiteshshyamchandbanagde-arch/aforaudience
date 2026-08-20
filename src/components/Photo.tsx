"use client"
import { useEffect, useRef, useState, type CSSProperties } from "react"

// Permanent amber/sepia duotone treatment for event photography, per the
// V2 design spec (docs/design.md §9.1). Grayscale + contrast + brightness
// on the base image, with a warm amber field multiplied over it at ~48% -
// deliberately NOT hover/group-hover gated (a bug found in the website
// Figma Make export's own card, confirmed against the mobile export's
// correct reference implementation, which renders identically at rest).
//
// Fills its nearest positioned ancestor by default (position: absolute,
// inset: 0) - wrap it in a sized `position: relative` container and layer
// any overlay content (badges, text) on top, same as a plain <img> would
// have been used.
//
// BUG-2608-079 - a DB-stored src that 404s, times out, or points at a
// dead/blocked host (confirmed live: qa-general-event-04's Unsplash
// posterImage) previously rendered a broken <img> with the amber overlay
// still multiplied on top of it, since nothing here ever reacted to the
// img's error event. Tracks the failed src (not just a bare boolean) so
// a later re-render with a genuinely different `src` isn't permanently
// blocked by an earlier failure - only a repeat of the exact same bad
// src stays suppressed. Callers that have their own illustrated
// fallback for the surface (VenueNoPhoto, ArtistNoPhoto,
// IllustratedEventFallback, etc.) pass `onError` to swap to it; Photo
// itself has no knowledge of which fallback is right for a given
// surface, so it only ever hides itself (same as the existing `!src`
// path) rather than guessing.
export default function Photo({
  src,
  alt,
  style,
  onError,
}: {
  src: string | null | undefined
  alt: string
  style?: CSSProperties
  onError?: () => void
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // Verified live in this sandbox (Playwright + a window-level capture-
  // phase listener): the browser dispatches the native `error` event on
  // a failed <img> correctly, but React's synthetic onError prop on
  // <img> never receives it in this Next.js 16 / React 19 setup - a
  // plain <img onError={...}> with zero other code involved reproduces
  // the same silent miss, so this isn't a Photo.tsx-specific bug, it's
  // an environment quirk (see AGENTS.md: "this is NOT the Next.js you
  // know"). Attaching the listener directly to the DOM node side-steps
  // whatever's swallowing the synthetic event. The `complete &&
  // naturalWidth === 0` check right after attaching covers a failure
  // that already resolved before this effect ran (a fast local 404 can
  // finish loading before React's commit phase gets here).
  useEffect(() => {
    const img = imgRef.current
    if (!img || !src) return
    const handleError = () => {
      setFailedSrc(src)
      onError?.()
    }
    if (img.complete && img.naturalWidth === 0) {
      handleError()
      return
    }
    img.addEventListener("error", handleError)
    return () => img.removeEventListener("error", handleError)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  if (!src || src === failedSrc) return null
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "grayscale(1) contrast(1.25) brightness(0.9)",
        }}
      />
      <div
        aria-hidden
        style={{ position: "absolute", inset: 0, backgroundColor: "#C9973A", opacity: 0.48, mixBlendMode: "multiply" }}
      />
    </div>
  )
}
