import type { CSSProperties, ReactNode } from 'react'

// BUG-2610-028 - one page-title style for every role dashboard. The
// Venue Owner portal's PageHead set its own 34px UI-font h1 while the
// Organiser/Artist pages used the display serif, so the same kind of
// page looked like two products. design.md "Page-title tier" (12 Sep):
// var(--font-display), weight 700, 28px (`--afa-text-page-title`) for a
// nested dashboard page, 32px (`--afa-text-page-title-lg`) for a
// top-level "your own account" page (Your Events, Your Venues, Edit Your
// Profile).

export type PageTitleSize = 'default' | 'lg'

export function pageTitleStyle(size: PageTitleSize = 'default'): CSSProperties {
  return {
    fontFamily: 'var(--font-display)',
    fontSize: size === 'lg' ? 'var(--afa-text-page-title-lg)' : 'var(--afa-text-page-title)',
    fontWeight: 700,
    color: 'var(--afa-text-primary)',
  }
}

export function PageTitle({
  size = 'default',
  style,
  children,
}: {
  size?: PageTitleSize
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <h1 data-afa-page-title="" style={{ ...pageTitleStyle(size), ...style }}>
      {children}
    </h1>
  )
}

// Stat-card labels follow the same rule: the Organiser/Artist label
// (sans, 600, small caps-style uppercase), never the portal's mono.
export const statLabelStyle: CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--afa-text-small)',
  color: 'var(--afa-text-secondary)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
}

export function StatLabel({ style, children }: { style?: CSSProperties; children: ReactNode }) {
  return (
    <p data-afa-stat-label="" style={{ ...statLabelStyle, ...style }}>
      {children}
    </p>
  )
}
