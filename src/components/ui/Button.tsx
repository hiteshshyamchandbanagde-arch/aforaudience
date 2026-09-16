'use client'

import Link from 'next/link'
import { FILL_SOLID_TINT, FILL_SOLID_BORDER_TINT } from '@/lib/statusStyle'

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

type ButtonVariant = 'primary' | 'secondary' | 'secondary-reveal' | 'close' | 'outline' | 'outline-neutral' | 'form-submit' | 'toggle-pill'

// GEN-2609-058 - a size scale orthogonal to variant: controls padding/
// font-size/font-weight/border-radius only, never color/background.
// `close`'s numeric size predates this and means something different
// (the circle's pixel diameter) - kept as-is, the two meanings coexist
// via the `size` prop's union type below rather than colliding, since
// only `close` ever reads the numeric form and no other variant reads
// the numeric form at all.
// GEN-2609-066 - `pill-sm`/`pill-md` added for a real, recurring
// solid-fill pill shape (borderRadius 999) found independently across
// 4 sites during the terracotta sweep - none fit `sm`/`md`/`lg`'s
// 6/8/8 radius scheme at all. See `SIZE_CHROME` below for the full
// reasoning on which 2 of the 4 sites share a shape and which is
// genuinely distinct.
type ButtonSizeToken = 'sm' | 'md' | 'lg' | 'pill-sm' | 'pill-md'

type BaseProps = {
  variant: ButtonVariant
  children: React.ReactNode
  fullWidth?: boolean
  /** For `close`: the shared circle's pixel diameter (36px everywhere it
   * floats over a sheet/modal; a small inline use needs a smaller
   * footprint instead of literally 36px breaking that layout). For every
   * other variant: one of the shared size tokens (`sm`/`md`/`lg`/
   * `pill-sm`/`pill-md`) -
   * see `SIZE_CHROME` below. Leaving it unset on a non-`close` variant
   * keeps that variant's own hardcoded padding/font-size/radius exactly
   * as they were before this prop existed - no default size token is
   * silently applied. */
  size?: number | ButtonSizeToken
  /** `toggle-pill` only - whether this pill is the currently-selected
   * option in its group. Ignored by every other variant (each of those
   * is a single-state CTA role, not a two-state selector) - see
   * `toggle-pill`'s own case in `variantBaseStyle` below. */
  selected?: boolean
  /** Optional leading icon, rendered before `children` - same additive,
   * optional-and-harmless convention as `Badge.tsx`/`MessageButton.tsx`
   * (GEN-2609-068): sized/positioned by the caller, laid out here via a
   * `gap` that only takes effect once `icon` is actually passed. */
  icon?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

type ButtonAsButton = BaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style' | 'className' | 'children'> & {
    href?: undefined
  }

type ButtonAsLink = BaseProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'style' | 'className' | 'children' | 'href'> & {
    /** Renders as a Next Link instead of a <button> - same visual
     * treatment, real navigation. `onClick` still fires (Next `Link`
     * supports it natively for side effects alongside navigation, e.g.
     * GEN-2609-066's `DisplayNameNudge`/`PhoneVerifyNudge` dismissing
     * their own banner on click-through) - it doesn't replace
     * navigation the way a plain `<button>`'s `onClick` would. */
    href: string
  }

type ButtonProps = ButtonAsButton | ButtonAsLink

const FONT_FAMILY = 'var(--font-sans)'

// GEN-2609-058 - re-verified fresh against qa (not assumed) across the
// 14 --afa-terracotta button-shaped call sites in dashboard/organiser/
// this replaces: sm's 2 real sites were already identical on padding
// (4px 10px) and radius (6px), only font-size/weight drifted (11/700 vs
// 12/600) - picked 12/600 as canonical. md's 3 sites were already
// identical on font-size (13px) and radius (8px); padding varied 8-9px/
// 16-18px, rounded to 9px 17px per the approved decision; weight was
// 600 on 2 of 3 (the 3rd, "Save override", was a real bug - see below).
// lg's 9 sites were already identical on font-size (14px), weight (600)
// and radius (8px); only padding varied (10-12px/22-26px), rounded to
// 12px 24px. Every site's small delta from its own prior exact value is
// a deliberate, documented consequence of consolidating onto one shared
// scale (same tradeoff class as GEN-2609-055's Badge variants) - not an
// oversight.
// GEN-2609-066 - re-verified all 4 flagged sites fresh, not trusted
// from the prior audit. `DisplayNameNudge.tsx`/`PhoneVerifyNudge.tsx`
// were byte-identical on every property (padding, radius, font-size/
// weight) - one real shape, `pill-sm`. `pwa/InstallPrompt.tsx`'s
// "Install" button is genuinely different (bigger padding, 1px larger
// font) - its own `pill-md`, not forced into `pill-sm`. The would-be
// 4th instance - `RegisterForm.tsx`'s username-suggestion chip - turned
// out NOT to belong here at all once checked: it's a translucent-tint
// utility chip (8%/25%-alpha background/border, text-colored, no solid
// fill), the same architectural pattern as the selection-pills
// GEN-2609-063 already centralized via `statusStyle.ts`'s
// `FILL_SOLID_TINT`/`fillSolidTint()` - not a `Button`-shaped CTA, so
// it's fixed there instead of getting a 3rd pill size here.
const SIZE_CHROME: Record<ButtonSizeToken, { padding: string; borderRadius: number; fontSize: number; fontWeight: number }> = {
  sm: { padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 },
  md: { padding: '9px 17px', borderRadius: 8, fontSize: 13, fontWeight: 600 },
  lg: { padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600 },
  'pill-sm': { padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600 },
  'pill-md': { padding: '10px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600 },
}

// Exported (not just used internally) so a caller that can't render a
// literal <Button> - e.g. profile/page.tsx's avatar-upload control,
// which has to be a <label> wrapping a hidden file input, not a
// <button> - can still apply the exact same variant look directly.
export function variantStyle(variant: ButtonVariant, fullWidth: boolean, size: number | ButtonSizeToken, selected = false): React.CSSProperties {
  const base = variantBaseStyle(variant, fullWidth, size, selected)
  // The size-token overlay applies to every variant uniformly (padding/
  // font-size/font-weight/border-radius only) - deliberately after the
  // variant's own base style so it wins, and deliberately never touches
  // color/background/border-color, which stay whatever the variant says.
  return typeof size === 'string' ? { ...base, ...SIZE_CHROME[size] } : base
}

function variantBaseStyle(variant: ButtonVariant, fullWidth: boolean, size: number | ButtonSizeToken, selected: boolean): React.CSSProperties {
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
    case 'outline':
      // GEN-2609-047 - a CTA-weight action that needs to read as clearly
      // distinct from its own container when that container is ALREADY
      // `--afa-fill-solid` (NotificationOptIn.tsx's banner background) -
      // `primary`'s solid fill would render identically to the banner
      // behind it. Transparent fill + `--afa-on-fill-solid`
      // border/text reuses the exact same token this component's own
      // message text already sits on `--afa-fill-solid` with (line 88 at
      // the time this was added), so it's a proven-legible pair on this
      // background, not a new one.
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: fullWidth ? '100%' : undefined,
        background: 'transparent',
        color: 'var(--afa-on-fill-solid)',
        padding: 16,
        border: '1.5px solid var(--afa-on-fill-solid)',
        borderRadius: 999,
        fontSize: 16,
        fontWeight: 700,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
        textDecoration: 'none',
      }
    case 'outline-neutral':
      // GEN-2609-068 - the /tickets/ page's redesigned secondary action
      // row (Download PDF / Message Organiser / Cancel) needs 3 equal-
      // weight actions, none color-coded, none --afa-fill-solid - a real
      // gap `outline` doesn't cover (that variant is CTA-weight: 999px
      // pill, 16px font, 1.5px border, built for a single high-emphasis
      // action on a --afa-fill-solid background, not a compact row of
      // ordinary actions on a card). Neutral translucent-cream border/
      // text, using the shared --afa-border-resting token (added here -
      // this exact alpha was already the de facto resting-border color
      // app-wide but had no name until now) rather than a new one-off
      // value.
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: fullWidth ? '100%' : undefined,
        background: 'transparent',
        color: 'var(--afa-text-secondary)',
        border: '1px solid var(--afa-border-resting)',
        // Own baseline chrome (not left to the `size` overlay alone) so
        // this renders sensibly even if a future caller omits `size` -
        // same defensive convention every other variant already follows.
        // A `size` token (this ticket always passes `sm`) overrides these.
        padding: '4px 10px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
        textDecoration: 'none',
      }
    case 'form-submit':
      // GEN-2609-053 - not a re-derivation of `primary`, an actual
      // second solid-fill role found by audit: `primary` is the pill-
      // shaped (999px) inline CTA from the booking/checkout flow;
      // login/register/forgot-password/reset-password's full-width
      // form submit buttons are a distinct, separately-shipped 8px-
      // radius look, byte-identical across all 8 occurrences in those
      // 4 files (own padding/font-size/font-weight, not primary's).
      // Real, repeated pattern - same discipline as the `outline`
      // variant added in GEN-2609-047, not invented from nothing.
      // `color` was hardcoded 'white' at every call site - NOT swapped
      // to `--afa-on-fill-solid` (that's `primary`'s text token here,
      // but it resolves to `--afa-brown-black` / #1A1000, a near-black
      // that would be a real, debatable text-color change on this
      // background, not a safe extraction - caught only by checking the
      // token's actual resolved value in globals.css before using it).
      // `--afa-cream` (#F7F3EE) is used instead: this repo's own
      // documented "primary text-on-dark" token, visually
      // indistinguishable from literal white against `--afa-fill-solid`,
      // so this removes the hardcoded literal with no visible change.
      return {
        display: 'block',
        width: fullWidth ? '100%' : undefined,
        background: 'var(--afa-fill-solid)',
        color: 'var(--afa-cream)',
        padding: 16,
        border: 'none',
        borderRadius: 8,
        fontSize: 15,
        fontWeight: 600,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
      }
    case 'toggle-pill':
      // GEN-2609-069 - the segmented/filter/toggle shape found dominating
      // BUG-2609-048's 239-raw-button inventory: a group of discrete,
      // individually-bordered pills (not one container with dividers),
      // each independently selectable. Design confirmed before build,
      // spec locked - not re-derived here.
      //
      // Reuses `pill-sm`/`pill-md` from SIZE_CHROME for shape (999px
      // radius, padding, font-size/weight) - this variant only defines
      // color/border, same division of responsibility `size` already
      // has with every other variant. Font-size check against the Step-1
      // type scale (docs/afa-design-tokens-reference.md Section 8): no
      // divergence to flag - `pill-sm`'s 13px is exactly
      // `--afa-text-ui`, `pill-md`'s 14px is exactly `--afa-text-body`.
      //
      // Selected state deliberately uses FILL_SOLID_BORDER_TINT (a
      // translucent border), NOT the solid `2px solid var(--afa-fill-
      // solid)` border GEN-2609-063/-066/BUG-2609-048's 26 already-
      // shipped box-shaped selector sites use - a real, locked
      // difference from that convention for this specific pill shape,
      // not an inconsistency to reconcile. Both states keep the same
      // 1px border width - only color/background move - since the
      // spec calls for discrete individually-bordered pills, not a
      // width change on selection.
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: fullWidth ? '100%' : undefined,
        background: selected ? FILL_SOLID_TINT : 'transparent',
        border: `1px solid ${selected ? FILL_SOLID_BORDER_TINT : 'var(--afa-border-resting)'}`,
        color: selected ? 'var(--afa-fill-solid)' : 'var(--afa-text-secondary)',
        // Own baseline chrome (same defensive convention as
        // `outline-neutral`) so this renders sensibly even if a future
        // caller omits `size` - callers should always pass `pill-sm`/
        // `pill-md` per the spec, this is only the fallback.
        padding: '6px 14px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
        textDecoration: 'none',
      }
    case 'close': {
      // `close` is the one variant that reads `size` as a pixel diameter,
      // not a size token - guard against the (currently unused) string
      // form reaching here instead of silently rendering width:'sm'.
      const diameter = typeof size === 'number' ? size : 36
      return {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: diameter,
        height: diameter,
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
}

export default function Button(props: ButtonProps) {
  const { variant, children, fullWidth = true, size = 36, selected = false, icon, style, className } = props
  const merged: React.CSSProperties = {
    ...variantStyle(variant, fullWidth, size, selected),
    ...('disabled' in props && props.disabled ? { opacity: 0.7, cursor: 'default' } : null),
    ...style,
  }
  const content = (
    <>
      {icon}
      {children}
    </>
  )

  if ('href' in props && props.href) {
    const { variant: _v, children: _c, fullWidth: _fw, size: _s, selected: _sel, icon: _ic, style: _st, className: _cl, href, ...anchorRest } = props as ButtonAsLink
    return (
      <Link href={href} style={merged} className={className} {...anchorRest}>
        {content}
      </Link>
    )
  }

  const { variant: _variant, children: _children, fullWidth: _fullWidth, size: _size, selected: _selected, icon: _icon, style: _style, className: _className, ...rest } = props as ButtonAsButton
  return (
    <button {...rest} style={merged} className={className}>
      {content}
    </button>
  )
}
