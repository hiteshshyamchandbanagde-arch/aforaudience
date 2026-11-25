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

// City-filter dropdown chevron (BUG-2608-072-class gap, this audit) -
// matches the export's IconChevronDown (icons.tsx), rotated open/closed
// by the caller.
export function ChevronDownIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DirectionsIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M3 11 21 3l-8 18-2-8z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Card hover-reveal mark (BUG-2608-072 gap 4) - VenueCard.tsx's circular
// arrow-up-right button that fades in top-right of the photo on hover.
export function ArrowUpRightIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M7 17 17 7M8 7h9v9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Sidebar "Follow this venue" CTA (BUG-2608-072 gap 5) - matches the
// export's IconPlus shown before the label when not yet following.
export function PlusIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
//
// Wholesale port from the export (VenueMedia.tsx IntimateRoom/MidHall/
// LargeArena) - the previous IntimateRoomMark/MidHallMark/LargeArenaMark
// were a hand-drawn "interpretation" (different viewBox, different scene
// entirely), not a copy of the export's actual path data. Every
// coordinate below is copied verbatim from the export, including the
// `v`-seeded variation (lamp vs. floor spotlight, chair/row/tier counts)
// - the export's fallback isn't one fixed illustration per tier, it's
// parameterized by a hash of the venue id (see seedFromVenueId below,
// port of the export's seedFrom), so a real port has to carry that
// variation logic too, not just one frozen snapshot of the geometry.
// viewBox is 0 0 400 300 (was 0 0 200 140) to match the export exactly -
// this also happens to equal the card media wrapper's own 4:3 aspect
// ratio, whereas the old 200x140 (10:7) didn't.

// Port of the export's seedFrom (VenueMedia.tsx line 10-14) - same djb2-
// style hash, used to derive the `v` variation seed from the venue id.
export function seedFromVenueId(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return h
}

type MarkProps = IconProps & { v: number }

// Intimate: low stage with a stool+mic, two rows of chairs, a pendant
// lamp or floor spotlight (alternates on v % 2).
export function IntimateRoomMark({ v, className, style }: MarkProps) {
  const lamp = v % 2 === 0 // pendant lamp vs. floor spotlight
  return (
    <svg viewBox="0 0 400 300" fill="none" className={className} style={style} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* room walls */}
        <path d="M70 60v130h260V60" opacity="0.55" />
        <path d="M40 190h320" />
        {/* low stage */}
        <path d="M150 190v-26h100v26" />
        <path d="M150 164h100" />
        {/* stool + mic on stage */}
        <path d="M196 164v-22m0-22a5 5 0 0 1 0 10m0-10a5 5 0 0 0 0 10m0 0v10" opacity="0.9" />
        <path d="M188 142h16" opacity="0.5" />
        {/* two intimate rows of chairs */}
        {[210, 232].map((y, r) => (
          <g key={y} opacity={0.9 - r * 0.15}>
            {Array.from({ length: 6 + (v % 2) }).map((_, i) => (
              <path key={i} d={`M${110 + i * 30} ${y}v-12h10v12`} transform={r ? `translate(${8},0)` : ""} />
            ))}
          </g>
        ))}
        {lamp ? (
          <g opacity="0.8">
            <path d="M200 60v18" />
            <path d="M188 78h24l-6 12h-12z" />
          </g>
        ) : (
          <g opacity="0.8">
            <path d="M96 190v-40l14-14" />
            <path d="M104 132a7 7 0 1 1 14 0l-8 8h-8z" />
            <path d="M114 140 150 178" strokeDasharray="2 6" opacity="0.6" />
          </g>
        )}
      </g>
    </svg>
  )
}

// Mid-size: proscenium arch + curtains, raked seating fanning outward
// (row count alternates 4-5 on v % 2).
export function MidHallMark({ v, className, style }: MarkProps) {
  const rows = 4 + (v % 2)
  return (
    <svg viewBox="0 0 400 300" fill="none" className={className} style={style} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* proscenium arch */}
        <path d="M120 44h160v96H120z" opacity="0.5" />
        <path d="M120 44c0 40-24 60-56 60m216-60c0 40 24 60 56 60" opacity="0.35" />
        {/* stage curtains */}
        <path d="M120 44v72m20-72v58m140-58v72m-20-72v58" opacity="0.45" />
        {/* stage lip */}
        <path d="M96 140h208" />
        {/* raked seating fanning outward */}
        {Array.from({ length: rows }).map((_, r) => {
          const y = 168 + r * 20
          const spread = 120 + r * 34
          return (
            <path key={r} d={`M${200 - spread} ${y}q${spread} ${16 + r * 4} ${spread * 2} 0`} opacity={0.85 - r * 0.12} />
          )
        })}
        {/* aisle */}
        <path d="M200 156v96" strokeDasharray="3 7" opacity="0.4" />
      </g>
    </svg>
  )
}

// Large: concentric arena bowl tiers around a center stage, radial
// section dividers, roof trusses/floodlights (tier count alternates 3-4
// on v % 2).
export function LargeArenaMark({ v, className, style }: MarkProps) {
  const tiers = 3 + (v % 2)
  return (
    <svg viewBox="0 0 400 300" fill="none" className={className} style={style} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* stage / field at center */}
        <ellipse cx="200" cy="196" rx="60" ry="20" opacity="0.9" />
        <path d="M180 196h40M200 176v40" opacity="0.4" />
        {/* concentric arena bowl tiers */}
        {Array.from({ length: tiers }).map((_, t) => {
          const rx = 92 + t * 34
          const ry = 30 + t * 12
          return <ellipse key={t} cx="200" cy="196" rx={rx} ry={ry} opacity={0.7 - t * 0.14} />
        })}
        {/* radial section dividers */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (Math.PI * 2 * i) / 8
          const outR = 92 + (tiers - 1) * 34
          return (
            <path
              key={i}
              d={`M${200 + Math.cos(a) * 92} ${196 + Math.sin(a) * 30}L${200 + Math.cos(a) * outR} ${196 + Math.sin(a) * (30 + (tiers - 1) * 12)}`}
              opacity="0.22"
            />
          )
        })}
        {/* roof trusses / floodlights */}
        <path d="M60 70l40 40M340 70l-40 40M200 54v22" opacity="0.5" />
        <path d="M54 64h12M334 64h12M194 48h12" opacity="0.7" />
      </g>
    </svg>
  )
}
