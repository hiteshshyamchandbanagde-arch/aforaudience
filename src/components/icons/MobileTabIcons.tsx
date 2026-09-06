import type { CSSProperties } from "react"

// Line-art SVG icons for the mobile tab shell (GEN-2609-003, Mobile
// Redesign Phase 1). Same convention as EventIcons.tsx/VenueIcons.tsx/
// ArtistIcons.tsx (stroke/currentColor on the <svg> directly, style prop
// alongside className) - path shapes ported from the Figma Make export's
// icons.tsx (CompassIcon/TicketIcon/HeartIcon/UserIcon), not the unused
// lucide-react dependency.

type IconProps = { className?: string; style?: CSSProperties }

// All 4 icons share one signature (including the unused `filled` prop on
// 3 of them) so callers - MobileTabBar's tabs array - can treat them
// interchangeably via one Icon type instead of a per-tab special case.
export function DiscoverTabIcon({ className, style }: IconProps & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function TicketsTabIcon({ className, style }: IconProps & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path
        d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13 7v10" stroke="currentColor" strokeWidth="1.7" strokeDasharray="1.5 2.5" />
    </svg>
  )
}

export function SavedTabIcon({ className, style, filled }: IconProps & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} className={className} style={style} aria-hidden="true">
      <path
        d="M12 20s-7-4.35-9.5-8.5C.8 8.6 2.3 5.5 5.4 5.5c1.9 0 3.1 1.1 3.9 2.2.8-1.1 2-2.2 3.9-2.2 3.1 0 4.6 3.1 2.9 6C19 15.65 12 20 12 20Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ProfileTabIcon({ className, style }: IconProps & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
