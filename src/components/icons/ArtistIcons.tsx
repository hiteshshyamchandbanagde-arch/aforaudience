import type { CSSProperties } from "react"

// Line-art SVG marks for the artist directory/profile redesign
// (GEN-2608-073). Ported from the approved Figma Make export
// ("Discover Artists Directory Page") - hand-built vector icons, no emoji,
// no stock imagery. GuitarMark/MicMark/BookMask/DanceMark/QuillMark are
// deliberately restrained line-art used only in the no-photo fallback
// composition (see ArtistNoPhoto.tsx) - never a face or likeness, genre
// atmosphere only.
//
// style is accepted alongside className since this codebase styles via
// inline style objects, not Tailwind utility classes (the Figma export's
// source convention) - className is kept for callers that just need a
// bare positioning hook.

type IconProps = { className?: string; style?: CSSProperties }

export function SearchIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path d="m20 20-3.6-3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function SparkIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path
        d="M12 2c.6 4.9 2.5 6.8 7.4 7.4C14.5 10 12.6 11.9 12 16.8 11.4 11.9 9.5 10 4.6 9.4 9.5 8.8 11.4 6.9 12 2Z"
        fill="currentColor"
      />
      <path d="M18.5 15.5c.3 2.4 1.2 3.3 3.5 3.6-2.3.3-3.2 1.2-3.5 3.5-.3-2.3-1.2-3.2-3.5-3.5 2.3-.3 3.2-1.2 3.5-3.6Z" fill="currentColor" opacity="0.7" />
    </svg>
  )
}

export function ArrowIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M5 12h13m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CheckSealIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path
        d="M12 2.5 14.6 4l3 .2.9 2.9 2 2.2-1 2.8 1 2.8-2 2.2-.9 2.9-3 .2L12 21.5 9.4 20l-3-.2-.9-2.9-2-2.2 1-2.8-1-2.8 2-2.2.9-2.9 3-.2L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="m8.8 12 2.2 2.2 4.2-4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function RepeatIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M4 8a5 5 0 0 1 5-5h7l-2.2-2.2M20 16a5 5 0 0 1-5 5H8l2.2 2.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 1)" />
    </svg>
  )
}

export function GuitarMark({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M64 14 82 32l-9 9-3-3-14 14a15 15 0 1 1-16-16l14-14-3-3 9-9Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="42" cy="58" r="6" stroke="currentColor" strokeWidth="2.4" />
      <path d="m64 14 8-8m-8 8 4 4m8-8 4 4-6 2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function MicMark({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} style={style} aria-hidden="true">
      <rect x="40" y="14" width="20" height="38" rx="10" stroke="currentColor" strokeWidth="2.4" />
      <path d="M30 44a20 20 0 0 0 40 0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M50 64v18m-10 0h20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M44 24h12M44 32h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function BookMask({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M50 26C42 18 30 18 20 22v50c10-4 22-4 30 4 8-8 20-8 30-4V22c-10-4-22-4-30 4Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M50 26v50" stroke="currentColor" strokeWidth="2.4" />
      <path d="M28 36h12M28 46h12m20-10h12M60 46h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function DanceMark({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} style={style} aria-hidden="true">
      <circle cx="54" cy="20" r="7" stroke="currentColor" strokeWidth="2.4" />
      <path d="M54 27c-4 8-2 14 4 18l14 6m-18-24-14 4m6 20 6-16m0 16-10 22m10-22 10 22" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function QuillMark({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M78 18C52 22 34 40 26 66c14 2 30-2 40-14 8-10 12-22 12-34Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M26 66c8-14 20-24 34-30" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 82c4-8 8-12 14-16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
