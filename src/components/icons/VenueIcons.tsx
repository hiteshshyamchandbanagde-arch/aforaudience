import type { CSSProperties, ComponentType } from "react"

// Line-art SVG marks for the Venues directory/detail redesign
// (GEN-2608-074). Ported from the approved Figma Make export ("Venues
// Directory + Detail") - hand-built vector icons, no emoji, no stock
// imagery. Mirrors the ArtistIcons.tsx convention (style prop alongside
// className, since this codebase styles via inline style objects, not
// the Figma export's Tailwind classes).
//
// IntimateRoomMark/MidHallMark/LargeArenaMark are the capacity-tier
// illustrated fallback marks (see VenueNoPhoto.tsx) - Venue has no
// genre-equivalent category field, so these are keyed by capacity tier
// instead, same role ArtistIcons' Guitar/Mic/Book/Dance/Quill marks play
// for artists.

type IconProps = { className?: string; style?: CSSProperties }

export function DirectionsIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M3 11 21 3l-8 18-2-8z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Replaces the 🔔/🔕 emoji previously used for the follow-notify toggle
// (VenueFollowButton.tsx, caught during this redesign).
export function BellIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function BellOffIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M6 10a6 6 0 1 1 11 3.6M18 16H4c.5-.5 2-2 2-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 19a2 2 0 0 0 4 0M3 3l18 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function CapacityIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 19c0-3 2.5-5 5-5s5 2 5 5M14 19c0-2.2 1.6-4 3.5-4s3.5 1.8 3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function AcousticIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

// Generic fallback for any venue.facilities free-text value that doesn't
// match a recognized label below.
export function FacilityTagIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="m3 12 8-8h7a1 1 0 0 1 1 1v7l-8 8a1.5 1.5 0 0 1-2 0l-6-6a1.5 1.5 0 0 1 0-2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="15.5" cy="7.5" r="1.2" fill="currentColor" />
    </svg>
  )
}

export function ParkingIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 16V8h3a2.5 2.5 0 0 1 0 5h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function GreenRoomIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 20c0-3 2.2-5 5-5s5 2 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15 5.5c2 .5 3 2 3 4s-1 3.5-3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function CafeIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4c0 1-1 1-1 2s1 1 1 2M12 4c0 1-1 1-1 2s1 1 1 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function WheelchairIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <circle cx="12" cy="5" r="1.6" fill="currentColor" />
      <path d="M12 8v5l4 4M12 13H8l1-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10.5" cy="16" r="4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function AirConditioningIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M12 3v18M4.5 6.75l15 10.5M19.5 6.75l-15 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function SecurityIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M12 3 4.5 6v6c0 4.5 3 7.5 7.5 9 4.5-1.5 7.5-4.5 7.5-9V6L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function FoodCourtIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11M17 3c-2 0-3 2-3 4.5S16 11 17 11s2.5-2.5 2.5-2.5V3v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SoundSystemIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <rect x="6" y="3" width="12" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="16" r="3" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function BarIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M4 4h16l-7 9v6h3M9 19h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// facility label -> icon. Falls back to FacilityTagIcon for anything
// unrecognized (facilities is free-text entered by the venue owner, same
// as genre/style tags elsewhere in the app - no fixed enum to exhaust).
const FACILITY_ICON_MAP: Record<string, ComponentType<IconProps>> = {
  Parking: ParkingIcon,
  "Green Room": GreenRoomIcon,
  Cafe: CafeIcon,
  "Wheelchair Access": WheelchairIcon,
  "Air Conditioning": AirConditioningIcon,
  Security: SecurityIcon,
  "Food Court": FoodCourtIcon,
  "Sound System": SoundSystemIcon,
  Bar: BarIcon,
}

export function FacilityIcon({ label, className, style }: IconProps & { label: string }) {
  const Icon = FACILITY_ICON_MAP[label] || FacilityTagIcon
  return <Icon className={className} style={style} />
}

// --- Capacity-tier illustrated fallback marks (VenueNoPhoto.tsx) ---
// Intimate: a small stage arc facing a close semicircle of seating rows.
export function IntimateRoomMark({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 200 140" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M70 55 V25 h60 V55" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M55 90a45 45 0 0 1 90 0" stroke="currentColor" strokeWidth="2" />
      <path d="M45 108a55 55 0 0 1 110 0" stroke="currentColor" strokeWidth="2" />
      <line x1="100" y1="55" x2="100" y2="108" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 4" />
    </svg>
  )
}

// Mid-size: a wider proscenium stage with three concentric seating rows.
export function MidHallMark({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 200 140" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M60 60 V22 h20 V60 M120 60 V22 h20 V60" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <line x1="60" y1="60" x2="140" y2="60" stroke="currentColor" strokeWidth="2.2" />
      <path d="M45 88a55 55 0 0 1 110 0" stroke="currentColor" strokeWidth="2" />
      <path d="M35 106a65 65 0 0 1 130 0" stroke="currentColor" strokeWidth="2" />
      <path d="M25 122a75 75 0 0 1 150 0" stroke="currentColor" strokeWidth="2" />
      <line x1="100" y1="60" x2="100" y2="122" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 4" />
    </svg>
  )
}

// Large: overhead arena rings with radiating rigging/light lines at top.
export function LargeArenaMark({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 200 140" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M100 8 90 28M100 8v22M100 8l10 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="100" cy="90" rx="26" ry="16" stroke="currentColor" strokeWidth="1.8" />
      <ellipse cx="100" cy="90" rx="46" ry="30" stroke="currentColor" strokeWidth="1.8" />
      <ellipse cx="100" cy="90" rx="66" ry="44" stroke="currentColor" strokeWidth="1.8" />
      <ellipse cx="100" cy="90" rx="86" ry="58" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}
