import type { CSSProperties } from "react"

// Line-art marks for the Wall of Fame "no winner yet" state (dark-theme
// migration off Theme Phase 0's maroon-black/terracotta gradient header).
// Mirrors the ArtistIcons.tsx/VenueIcons.tsx convention (viewBox 0 0 100
// 100, currentColor stroke, style prop) - TrophyMark for Artist of the
// Month, StarMark for Event of the Month, so the two "no winner" cards
// stay visually distinct the same way IntimateRoomMark/MidHallMark/
// LargeArenaMark differentiate venue capacity tiers.

type IconProps = { className?: string; style?: CSSProperties }

export function TrophyMark({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M34 18h32v14a16 16 0 0 1-32 0V18Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M34 24H22a10 10 0 0 0 10 16M66 24h12a10 10 0 0 1-10 16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 48v14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M38 82h24M42 82c0-9 1.5-12 8-12s8 3 8 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StarMark({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} style={style} aria-hidden="true">
      <path
        d="M50 12 61 37 88 41 68 60 73 87 50 74 27 87 32 60 12 41 39 37 50 12Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}
