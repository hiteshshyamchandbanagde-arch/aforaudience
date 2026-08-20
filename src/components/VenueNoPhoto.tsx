import type { CSSProperties, ComponentType } from "react"
import { IntimateRoomMark, MidHallMark, LargeArenaMark, seedFromVenueId } from "@/components/icons/VenueIcons"

// No-photo fallback for venue cards/hero (GEN-2608-074). Replaces the old
// circular-monogram-letter treatment (monogramTone, src/lib/placeholder-image.ts)
// for venues specifically - artist cards keep ArtistNoPhoto, untouched,
// out of scope here.
//
// Per the approved design.md spec: Venue has no genre-equivalent category
// field (only capacity, always present), so the fallback is keyed by
// capacity tier instead - Intimate (<200) / Mid-size (200-800) / Large
// (800+) - each with its own distinct illustrated line-art panel, rather
// than a single repeated mark. Explicitly no stock photos, no emoji,
// nothing implying a real photo of a venue we haven't verified.

export type CapacityTier = "intimate" | "mid" | "large"

export function capacityTier(capacity: number): CapacityTier {
  if (capacity < 200) return "intimate"
  if (capacity < 800) return "mid"
  return "large"
}

const TIER_MARK: Record<CapacityTier, ComponentType<{ v: number; style?: CSSProperties }>> = {
  intimate: IntimateRoomMark,
  mid: MidHallMark,
  large: LargeArenaMark,
}

interface VenueNoPhotoProps {
  capacity: number
  // Venue id, hashed into the `v` seed that drives the export's
  // per-instance variation (lamp vs. spotlight, chair/row/tier counts -
  // see seedFromVenueId in VenueIcons.tsx). Optional only so existing
  // callers don't break at the type level while being migrated; falls
  // back to a fixed seed (matches export behavior for an empty seed
  // string, since seedFromVenueId("") === 0).
  seed?: string
  caption?: string
  size?: "card" | "hero"
}

// BUG-2608-072 gap 4 originally baked the tier-label badge into this
// component. Export (VenueCard.tsx) only ever shows that badge as a
// card-level overlay sibling to the media (real photo OR fallback) - the
// detail-page hero's fallback (VenueDetail.tsx) has no badge at all, only
// the caption text below it. Badge now lives at the call site (card grid)
// instead, so it (a) also shows over real photos, which this component
// can't do since it only renders for the no-photo case, and (b) stops
// incorrectly appearing on the detail hero.
export default function VenueNoPhoto({ capacity, seed, caption, size = "card" }: VenueNoPhotoProps) {
  const tier = capacityTier(capacity)
  const Mark = TIER_MARK[tier]
  const v = seedFromVenueId(seed ?? "")
  // Card variant matches the export's VenueFallback exactly - the SVG is
  // `absolute inset-0 h-full w-full`, full-bleed with zero container
  // padding; whatever breathing room the artwork has comes from empty
  // space drawn inside each Mark's own viewBox coordinates, not a shrink
  // here. Hero sizing is left as the pre-existing 70%/420px, flex-centered
  // - unverified against the export's detail-page fallback specifically,
  // so not changed on the strength of the card-only finding this covers.

  return (
    // BUG-2608-074 - this reused --afa-surface-page (the page background
    // itself), giving the illustration panel zero visual distinction from
    // the page behind it. With no visible card, the tierLabel badge below
    // (meant to overlay the panel's top-left corner) read as a stray
    // floating label between the header actions and the illustration
    // instead of a badge sitting on a card. --afa-surface-raised is the
    // locked palette's dedicated "elevated panel" token (docs/design.md).
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--afa-surface-raised)" }}>
      {/* Grid/graph-paper texture (export: VenueMedia.tsx line 115-123,
          quoted via Claude Code). Two 1px cream linear-gradients (one
          vertical, one horizontal) on a 22x22px cell, 4% opacity - a
          crosshatch, not a single pattern image or Tailwind bg-grid
          utility. Sits behind the Mark SVG, same relative parent. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.04,
          backgroundImage:
            "linear-gradient(var(--afa-cream) 1px, transparent 1px), linear-gradient(90deg, var(--afa-cream) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      {size === "card" ? (
        <Mark v={v} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", color: "var(--afa-amber)", opacity: 0.55 }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Mark v={v} style={{ width: "70%", maxWidth: "420px", color: "var(--afa-amber)", opacity: 0.55 }} />
        </div>
      )}

      {caption && (
        <span style={{ position: "absolute", bottom: size === "hero" ? "16px" : "8px", left: size === "hero" ? "16px" : "10px", right: size === "hero" ? "16px" : "10px", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.04em", color: "var(--afa-cream)", opacity: 0.4, textTransform: "uppercase" }}>
          {caption}
        </span>
      )}
    </div>
  )
}
