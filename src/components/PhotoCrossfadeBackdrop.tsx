"use client"
import { useState } from "react"
import Photo from "@/components/Photo"

/**
 * Shared absolute-positioned crossfade layer + gradient overlays + empty-
 * state fallback, extracted from the homepage Hero (GEN-2608-072) so the
 * Artist landing page's hero reuses the same visual treatment instead of
 * a parallel copy. Palette-only empty-state gradient (--afa-ink,
 * --afa-surface-inverse, --afa-amber) - same technique FourRooms.tsx's
 * room panels already reuse.
 */
export default function PhotoCrossfadeBackdrop({
  photos,
  active,
}: {
  photos: { src: string; alt: string }[]
  active: number
}) {
  // BUG-2608-079 - a photo in the rotation that 404s/times out previously
  // left Photo rendering a broken <img> for that slide once it became
  // active. Tracked by src (not index) so a reordered/refetched `photos`
  // array doesn't misattribute an old failure to a different photo now
  // sitting at the same index. Falls back to the exact same empty-state
  // gradient already used when there are no photos at all - this
  // component has no per-photo illustrated fallback of its own to swap
  // to, same as every other "no genuine content" case here.
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(new Set())
  const visiblePhotos = photos.filter((p) => !failedSrcs.has(p.src))
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {visiblePhotos.length > 0 ? (
        photos.map((photo, i) => (
          failedSrcs.has(photo.src) ? null : (
            <div key={photo.src} style={{ position: "absolute", inset: 0, opacity: i === active ? 1 : 0, transition: "opacity 1600ms ease-in-out" }}>
              <Photo src={photo.src} alt={photo.alt} onError={() => setFailedSrcs((prev) => new Set(prev).add(photo.src))} />
            </div>
          )
        ))
      ) : (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(140% 140% at 18% 0%, var(--afa-ink) 0%, var(--afa-surface-inverse) 60%), linear-gradient(135deg, rgba(201,151,58,0.08) 0%, rgba(201,151,58,0) 50%)",
          }}
        />
      )}
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, var(--afa-surface-inverse) 5%, rgba(10,10,10,0.45) 45%, rgba(10,10,10,0.7) 100%)" }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(10,10,10,0.85), rgba(10,10,10,0) 55%)" }} />
      {/* BUG-2608-071: HomeHeader floats position:absolute over this
          backdrop with no guaranteed contrast layer behind it, so a
          bright section of the active crossfade photo can wash out nav
          text/icons. Same technique as the bottom gradient above
          (var(--afa-surface-inverse) / its literal rgb(10,10,10), same
          opaque-anchor-then-fading-rgba shape), just compressed to the
          top ~20% instead of spanning the full height, so it fades out
          well before the "Live, right now" eyebrow lower in the hero. */}
      <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 1, background: "linear-gradient(180deg, var(--afa-surface-inverse) 0%, rgba(10,10,10,0.5) 8%, rgba(10,10,10,0) 20%)" }} />
    </div>
  )
}
