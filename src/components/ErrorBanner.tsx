import type { ReactNode, CSSProperties } from 'react'

// BUG-2608-092/BUG-2608-095: pre-dark-redesign light tokens
// (--afa-error-bg #FDECEA, --afa-success-bg #F0FFF4, --afa-error-border
// #F5C2C0) rendered as near-white boxes on dark-shell pages - only visible
// once a real error/success actually fired, which is why this went
// unnoticed across ~27 pages for as long as it did. Originally added to
// VenuePortalUI.tsx for the 7 venue-portal pages (BUG-2608-092); promoted
// here so every dark-shell page can share one definition instead of
// re-inventing it, reusing StatusPill's already-correct translucent-on-dark
// tone pairs rather than new colors. VenuePortalUI.tsx re-exports both from
// here so its existing importers don't need to change.

export function ErrorBanner({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        background: 'rgba(179,38,30,0.1)',
        border: '1px solid rgba(179,38,30,0.3)',
        borderRadius: '8px',
        color: 'var(--afa-error)',
        fontSize: '14px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function SuccessBanner({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        background: 'rgba(74,103,65,0.12)',
        border: '1px solid rgba(74,103,65,0.3)',
        borderRadius: '8px',
        color: 'var(--afa-sage)',
        fontSize: '14px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
