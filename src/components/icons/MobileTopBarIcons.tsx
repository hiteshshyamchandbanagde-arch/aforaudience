import type { CSSProperties } from "react"

// GEN-2609-019 (Mobile Nav v3, Phase A) - inline icons for the new global
// MobileTopBar, same convention as MobileTabIcons.tsx/EventIcons.tsx
// (stroke/currentColor on the <svg> directly). Shapes ported from the
// Figma Make "AFA Mobile App v3" export's icons.tsx (SearchIcon/PinIcon),
// not the unused lucide-react dependency.

type IconProps = { className?: string; style?: CSSProperties }

export function TopBarSearchIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function TopBarPinIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M12 21s6.5-5.6 6.5-10A6.5 6.5 0 0 0 5.5 11c0 4.4 6.5 10 6.5 10Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="11" r="2.3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

// No existing "globe/language" icon anywhere in this codebase's icon
// files (checked EventIcons/VenueIcons/ArtistIcons/MobileTabIcons/
// DashboardShell's internal Icon) - drawn fresh, same stroke convention.
export function TopBarGlobeIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
