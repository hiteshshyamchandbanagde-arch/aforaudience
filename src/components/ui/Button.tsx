'use client'

import Link from 'next/link'

// Shared Button - Step 4 of the UI/UX audit sequence
// (docs/afa-uiux-design-audit.md, Section 06/12 Step 4): extracted from
// the booking/checkout flow's six worst offenders after an explicit
// audit (see that step's findings) found 6 different "primary CTA"
// looks, 3 "secondary" looks, and 3 "close" looks for what were really
// only 3 functional roles. Variants below are exactly the roles that
// audit found - nothing invented that wasn't already shipping
// somewhere in this flow.
//
// `primary` is ContributionMoment.tsx's ViewTicketButton, verbatim -
// that screen was built clean against the Step 1 token scale and
// named the reference pattern explicitly, not re-derived here.
//
// Every variant sets fontFamily explicitly. This is the direct fix for
// the bug GEN-2609-028 shipped with: a <button> doesn't inherit
// font-family from its ancestors in the browser's UA stylesheet, and
// every ad hoc button in this flow except ContributionMoment's left it
// unset, silently falling back to the browser default (Times New
// Roman in the case that was actually caught live). Applied once here
// so no future button in this flow can reintroduce it.

type ButtonVariant = 'primary' | 'secondary' | 'secondary-reveal' | 'close'

type BaseProps = {
  variant: ButtonVariant
  children: React.ReactNode
  fullWidth?: boolean
  /** close variant only - the shared circle is 36px everywhere it floats
   * over a sheet/modal (ContributionMoment, FeeSheet); the one inline
   * use (a remove-chip inside a small pill) needs the same look at a
   * smaller footprint rather than literally 36px breaking that layout. */
  size?: number
  style?: React.CSSProperties
  className?: string
}

type ButtonAsButton = BaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style' | 'className' | 'children'> & {
    href?: undefined
  }

type ButtonAsLink = BaseProps & {
  /** Renders as a Next Link instead of a <button> - same visual
   * treatment, real navigation instead of an onClick handler. Only the
   * checkout page's expired-state "Back to event" needs this today (it
   * was a <Link> styled inline before this extraction); every other
   * primary-CTA site keeps its onClick-driven <button>. */
  href: string
}

type ButtonProps = ButtonAsButton | ButtonAsLink

const FONT_FAMILY = 'var(--font-sans)'

// Exported (not just used internally) so a caller that can't render a
// literal <Button> - e.g. profile/page.tsx's avatar-upload control,
// which has to be a <label> wrapping a hidden file input, not a
// <button> - can still apply the exact same variant look directly.
export function variantStyle(variant: ButtonVariant, fullWidth: boolean, size: number): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: fullWidth ? '100%' : undefined,
        background: 'var(--afa-fill-solid)',
        color: 'var(--afa-on-fill-solid)',
        padding: 16,
        border: 'none',
        borderRadius: 999,
        fontSize: 16,
        fontWeight: 700,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
        textDecoration: 'none',
      }
    case 'secondary':
      // Muted-gray dismiss/cancel look (CorporateInquiryModal's
      // "Cancel" + AuthPromptSheet's "Keep browsing") - both the same
      // treatment with a padding-top drift (6px vs 10px); merged to a
      // single value here rather than picking one caller's over the
      // other's.
      return {
        display: 'block',
        width: fullWidth ? '100%' : undefined,
        textAlign: 'center',
        background: 'transparent',
        border: 'none',
        color: 'var(--afa-text-primary)',
        opacity: 0.4,
        fontSize: 13,
        fontFamily: FONT_FAMILY,
        padding: '8px 0 0',
        cursor: 'pointer',
      }
    case 'secondary-reveal':
      // Amber informational-reveal look (checkout's "See fee
      // breakdown ->") - a distinct role from `secondary` (reveals
      // detail, doesn't dismiss/cancel anything), kept separate per
      // the build decision rather than folded into the muted style.
      return {
        display: 'block',
        width: fullWidth ? '100%' : undefined,
        textAlign: 'right',
        background: 'none',
        border: 'none',
        padding: 0,
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--afa-amber)',
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
      }
    case 'close':
      return {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: 'rgba(245,245,240,0.08)',
        color: 'var(--afa-text-secondary)',
        border: 'none',
        fontSize: 16,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
      }
  }
}

export default function Button(props: ButtonProps) {
  const { variant, children, fullWidth = true, size = 36, style, className } = props
  const merged: React.CSSProperties = {
    ...variantStyle(variant, fullWidth, size),
    ...('disabled' in props && props.disabled ? { opacity: 0.7, cursor: 'default' } : null),
    ...style,
  }

  if ('href' in props && props.href) {
    return (
      <Link href={props.href} style={merged} className={className}>
        {children}
      </Link>
    )
  }

  const { variant: _variant, children: _children, fullWidth: _fullWidth, size: _size, style: _style, className: _className, ...rest } = props as ButtonAsButton
  return (
    <button {...rest} style={merged} className={className}>
      {children}
    </button>
  )
}
