import type { ReactNode, ButtonHTMLAttributes, CSSProperties } from 'react'
export { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner'

// Shared visual layer for the Venue Owner Portal (dashboard/venue/*,
// dashboard/venue-requests), ported from the approved Figma Make export
// (docs/venue-owner-portal-export-audit.md). Presentational only - every
// page keeps its own data fetching/interaction logic, this file just gives
// them one consistent Card/Button/Pill/EmptyState/PageHead system instead
// of six copies of hand-rolled inline styles. Inline `style` objects (not
// Tailwind) to match the rest of dashboard/, even though the export itself
// is Tailwind-based.

/* ---------------- Icons (line-art, currentColor stroke) ---------------- */

type IconProps = { size?: number; style?: CSSProperties; strokeWidth?: number }
const svgProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function IconVenue({ size = 20, style, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0, ...style }} {...svgProps} strokeWidth={strokeWidth}>
      <path d="M3 21h18M5 21V8l7-4 7 4v13" />
      <path d="M9 21v-5h6v5M9 11h.01M15 11h.01M9 14h.01M15 14h.01" />
    </svg>
  )
}
export function IconCalendar({ size = 20, style, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0, ...style }} {...svgProps} strokeWidth={strokeWidth}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  )
}
export function IconChart({ size = 20, style, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0, ...style }} {...svgProps} strokeWidth={strokeWidth}>
      <path d="M4 4v16h16" />
      <path d="M8 15l3-4 3 2 4-6" />
    </svg>
  )
}
export function IconEdit({ size = 20, style, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0, ...style }} {...svgProps} strokeWidth={strokeWidth}>
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
    </svg>
  )
}
export function IconPlus({ size = 16, style, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0, ...style }} {...svgProps} strokeWidth={strokeWidth}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
export function IconCheck({ size = 16, style, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0, ...style }} {...svgProps} strokeWidth={strokeWidth}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}
export function IconX({ size = 16, style, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0, ...style }} {...svgProps} strokeWidth={strokeWidth}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}
export function IconUsers({ size = 20, style, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0, ...style }} {...svgProps} strokeWidth={strokeWidth}>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13A4 4 0 0116 11" />
    </svg>
  )
}
export function IconClock({ size = 20, style, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0, ...style }} {...svgProps} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
export function IconTag({ size = 20, style, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0, ...style }} {...svgProps} strokeWidth={strokeWidth}>
      <path d="M20.6 13.6L13 21.2a2 2 0 01-2.8 0l-7-7A2 2 0 012.8 12V4.8A1.8 1.8 0 014.6 3h7.2a2 2 0 011.4.6l7.4 7.4a2 2 0 010 2.6z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </svg>
  )
}
export function IconMap({ size = 20, style, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0, ...style }} {...svgProps} strokeWidth={strokeWidth}>
      <path d="M12 21s-7-6.3-7-11a7 7 0 1114 0c0 4.7-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

/* ---------------- Status pill ---------------- */
// Same bg/color pairs already established by organiser/page.tsx's
// STATUS_STYLE and the bookings/venue-requests STATUS_STYLE maps -
// consolidated into one component instead of a fourth copy of the same
// four color pairs, per docs/venue-owner-portal-export-audit.md's
// "reuse, don't reimplement" guidance on the export's own Pill/toneMap.

export type StatusPillTone = 'gold' | 'sage' | 'error' | 'muted'

const TONE_STYLE: Record<StatusPillTone, { bg: string; color: string }> = {
  gold: { bg: 'rgba(201,151,58,0.15)', color: 'var(--afa-gold)' },
  sage: { bg: 'rgba(74,103,65,0.12)', color: 'var(--afa-sage)' },
  error: { bg: 'rgba(179,38,30,0.1)', color: 'var(--afa-error)' },
  muted: { bg: 'rgba(245,245,240,0.08)', color: 'var(--afa-text-primary)' },
}

export function StatusPill({ tone, children }: { tone: StatusPillTone; children: ReactNode }) {
  const t = TONE_STYLE[tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: '10.5px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '5px 10px',
        borderRadius: '999px',
        lineHeight: 1,
        background: t.bg,
        color: t.color,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

/* ---------------- Buttons ---------------- */

type ButtonVariant = 'primary' | 'outline' | 'ghost'

export function Button({
  variant = 'primary',
  style,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    borderRadius: '8px',
    fontFamily: 'var(--font-sans)',
    fontSize: '13.5px',
    padding: '11px 20px',
    cursor: 'pointer',
    transition: 'filter 150ms, border-color 150ms, background 150ms, color 150ms',
  }
  const variants: Record<ButtonVariant, CSSProperties> = {
    primary: { background: 'var(--afa-fill-solid)', color: 'var(--afa-on-fill-solid)', fontWeight: 600, border: 'none' },
    outline: { background: 'transparent', color: 'var(--afa-text-primary)', border: '1px solid rgba(245,245,240,0.2)' },
    ghost: { background: 'transparent', color: 'var(--afa-text-secondary)', border: 'none' },
  }
  const cls = { primary: 'avp-btn-primary', outline: 'avp-btn-outline', ghost: 'avp-btn-ghost' }[variant]
  return (
    <button className={`${cls} ${className}`} style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </button>
  )
}

/* ---------------- Card ---------------- */

export function Card({
  style,
  className = '',
  children,
  ...rest
}: { style?: CSSProperties; className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={className}
      style={{
        borderRadius: '12px',
        border: '1px solid rgba(245,245,240,0.08)',
        background: 'var(--afa-surface-raised)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

/* ---------------- Empty state ---------------- */

export function EmptyState({ icon, caption, action }: { icon: ReactNode; caption: string; action?: ReactNode }) {
  return (
    <div
      className="avp-crosshatch"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '12px',
        border: '1px solid rgba(245,245,240,0.08)',
        background: 'var(--afa-surface-raised)',
        padding: '80px 24px',
        textAlign: 'center',
      }}
    >
      <div style={{ color: 'rgba(201,151,58,0.55)', marginBottom: '24px' }}>{icon}</div>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          color: 'var(--afa-text-muted)',
        }}
      >
        {caption}
      </p>
      {action ? <div style={{ marginTop: '28px' }}>{action}</div> : null}
    </div>
  )
}

/* ---------------- Page header ---------------- */

export function PageHead({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description?: ReactNode
  children?: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        borderBottom: '1px solid rgba(245,245,240,0.08)',
        paddingBottom: '28px',
        marginBottom: '32px',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '20px' }}>
        <div>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              color: 'var(--afa-amber)',
              marginBottom: '8px',
            }}
          >
            {eyebrow}
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '34px',
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: '-0.01em',
              color: 'var(--afa-text-primary)',
              margin: 0,
            }}
          >
            {title}
          </h1>
          {description ? (
            <p style={{ fontSize: '14px', color: 'var(--afa-text-secondary)', marginTop: '10px', marginBottom: 0, maxWidth: '520px' }}>
              {description}
            </p>
          ) : null}
        </div>
        {children ? <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>{children}</div> : null}
      </div>
    </div>
  )
}

/* ---------------- Stat ---------------- */

export function Stat({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <Card style={{ padding: '20px' }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--afa-text-muted)', margin: 0 }}>
        {label}
      </p>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '26px', lineHeight: 1, color: 'var(--afa-text-primary)', margin: '12px 0 0' }}>{value}</p>
      {delta ? (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--afa-sage)', margin: '8px 0 0' }}>▲ {delta}</p>
      ) : null}
    </Card>
  )
}

/* ---------------- Section title (forms) ---------------- */

export function SectionTitle({ n, title }: { n: string; title: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '12px',
        borderBottom: '1px solid rgba(245,245,240,0.08)',
        paddingBottom: '12px',
        marginBottom: '20px',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--afa-amber)' }}>{n}</span>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '19px', fontWeight: 500, color: 'var(--afa-text-primary)', margin: 0 }}>{title}</h2>
    </div>
  )
}

/* ---------------- Nav pills + CTA links (Next <Link>, not <button>) ---------------- */
// Same visual system as Button, but as plain style objects for use on
// next/link <Link> elements where the action is routing, not a click
// handler - most of the top-of-page actions on these dashboard pages are
// routes (Edit Profile, Revenue Overview, ...), not button onClicks.

export const primaryLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  borderRadius: '8px',
  fontFamily: 'var(--font-sans)',
  fontSize: '13.5px',
  fontWeight: 600,
  padding: '11px 20px',
  background: 'var(--afa-fill-solid)',
  color: 'var(--afa-on-fill-solid)',
  textDecoration: 'none',
  border: 'none',
}

export const outlineLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  borderRadius: '8px',
  fontFamily: 'var(--font-sans)',
  fontSize: '13.5px',
  fontWeight: 600,
  padding: '11px 20px',
  background: 'transparent',
  color: 'var(--afa-text-primary)',
  textDecoration: 'none',
  border: '1px solid rgba(245,245,240,0.2)',
}

export const navPillStyle: CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  borderRadius: '8px',
  border: '1px solid rgba(245,245,240,0.08)',
  padding: '9px 14px',
  fontFamily: 'var(--font-sans)',
  fontSize: '13px',
  color: 'var(--afa-text-secondary)',
  textDecoration: 'none',
}

export function NavBadge({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        position: 'absolute',
        top: '-8px',
        right: '-8px',
        background: 'var(--afa-gold)',
        color: 'var(--afa-text-primary)',
        fontFamily: 'var(--font-mono)',
        fontSize: '10.5px',
        fontWeight: 600,
        borderRadius: '999px',
        padding: '2px 7px',
        lineHeight: 1.4,
      }}
    >
      {children}
    </span>
  )
}

/* ---------------- Form field primitives ---------------- */

export function Label({ children }: { children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500, color: 'var(--afa-text-secondary)' }}>
      {children}
    </label>
  )
}

const fieldStyle: CSSProperties = {
  width: '100%',
  borderRadius: '8px',
  border: '1px solid rgba(245,245,240,0.08)',
  background: '#171717',
  padding: '10px 14px',
  fontSize: '14px',
  fontFamily: 'var(--font-sans)',
  color: 'var(--afa-text-primary)',
  boxSizing: 'border-box',
}

export function Field(
  props: { as?: 'input' | 'textarea' } & React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  const { as = 'input', style, ...rest } = props
  if (as === 'textarea') {
    return (
      <textarea
        className="avp-field"
        style={{ ...fieldStyle, minHeight: '112px', resize: 'vertical', ...style }}
        {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
      />
    )
  }
  return (
    <input
      className="avp-field"
      style={{ ...fieldStyle, ...style }}
      {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
    />
  )
}
