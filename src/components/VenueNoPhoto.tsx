import type { CSSProperties, ComponentType } from "react"
import { IntimateRoomMark, MidHallMark, LargeArenaMark } from "@/components/icons/VenueIcons"

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

const TIER_MARK: Record<CapacityTier, ComponentType<{ style?: CSSProperties }>> = {
  intimate: IntimateRoomMark,
  mid: MidHallMark,
  large: LargeArenaMark,
}

interface VenueNoPhotoProps {
  capacity: number
  tierLabel: string
  caption?: string
  size?: "card" | "hero"
}

export default function VenueNoPhoto({ capacity, tierLabel, caption, size = "card" }: VenueNoPhotoProps) {
  const tier = capacityTier(capacity)
  const Mark = TIER_MARK[tier]
  const markWidth = size === "hero" ? "70%" : "82%"

  return (
    // BUG-2608-074 - this reused --afa-surface-page (the page background
    // itself), giving the illustration panel zero visual distinction from
    // the page behind it. With no visible card, the tierLabel badge below
    // (meant to overlay the panel's top-left corner) read as a stray
    // floating label between the header actions and the illustration
    // instead of a badge sitting on a card. --afa-surface-raised is the
    // locked palette's dedicated "elevated panel" token (docs/design.md).
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--afa-surface-raised)" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Mark style={{ width: markWidth, maxWidth: size === "hero" ? "420px" : "220px", color: "var(--afa-amber)", opacity: 0.55 }} />
      </div>

      <span style={{ position: "absolute", top: size === "hero" ? "16px" : "10px", left: size === "hero" ? "16px" : "10px", fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--afa-cream)", opacity: 0.6 }}>
        {tierLabel}
      </span>

      {caption && (
        <span style={{ position: "absolute", bottom: size === "hero" ? "16px" : "8px", left: size === "hero" ? "16px" : "10px", right: size === "hero" ? "16px" : "10px", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.04em", color: "var(--afa-cream)", opacity: 0.4, textTransform: "uppercase" }}>
          {caption}
        </span>
      )}
    </div>
  )
}
