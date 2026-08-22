import type { CSSProperties } from "react"

// Line-art SVG icons for the Organiser Profile page rebuild (this
// session, "Organiser Profile Page Design" Figma Make export). Same
// convention as EventIcons.tsx/VenueIcons.tsx/ArtistIcons.tsx - style
// prop alongside className, no emoji, no fill. Only the icons that don't
// already exist elsewhere - CalendarIcon/PinIcon (EventIcons.tsx) and
// ArrowUpRightIcon (VenueIcons.tsx) are reused as-is for everything the
// export's own Calendar/Pin/Arrow marks covered.
type IconProps = { className?: string; style?: CSSProperties }

// Tours section - two joined stops, echoing the export's RouteIcon.
// Reused both for the empty-state illustration and (smaller) next to
// each TourCard's title.
export function RouteIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <circle cx="6" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="18" r="2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 6h6a4 4 0 0 1 0 8h-4a4 4 0 0 0 0 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
