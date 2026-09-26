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
        background: 'var(--afa-error-tint)',
        border: '1px solid var(--afa-error-edge)',
        borderRadius: 'var(--afa-radius-md)',
        color: 'var(--afa-error-bright)',
        fontSize: 'var(--afa-text-body)',
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
        background: 'var(--afa-sage-tint)',
        border: '1px solid var(--afa-sage-tint)',
        borderRadius: 'var(--afa-radius-md)',
        color: 'var(--afa-sage-bright)',
        fontSize: 'var(--afa-text-body)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
