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

// GEN-2609-096 - `link`/`icon`/`bare` added for phase-1 raw-<button>
// adoption (see docs/button-adoption-audit.md's classification):
// `link` is the one real 3+-site exact-match shape found (Class B);
// `icon`/`bare` are the two general-purpose "keep the caller's own
// look, just reset the missing browser-default properties" variants
// Class C (icon-only controls) and Class D (structural, one-off CTAs)
// route through - see their own case blocks below for what each
// resets and why neither one re-skins anything.
// GEN-2609-109 - `outline-accent`/`success`/`outline-success`/`dashed`
// added for phase-2 bare -> real-variant adoption (docs/button-adoption-
// audit.md, "Phase 2"): each is a shape found at 3+ CTA-styled `bare`
// sites that no existing variant covered (the GEN-2609-066 3-site rule).
// See each case block below for its sites.
// GEN-2609-110 - `toggle-box`/`menu-row`/`text-link`/`text-toggle`/`tab`/
// `tab-display`/`disclosure`/`card`/`scrim` added for phase 3, the last 91
// `bare` sites (docs/button-adoption-audit.md, "Phase 3"): again one
// variant per look found at 3+ sites. What is left on `bare` carries a
// `// bare-reason:` comment saying why no variant fits.
type ButtonVariant = 'primary' | 'secondary' | 'secondary-reveal' | 'close' | 'outline' | 'outline-neutral' | 'form-submit' | 'toggle-pill' | 'toggle-box' | 'solid' | 'outline-error' | 'outline-accent' | 'success' | 'outline-success' | 'dashed' | 'link' | 'text-link' | 'text-toggle' | 'tab' | 'tab-display' | 'menu-row' | 'disclosure' | 'card' | 'scrim' | 'icon' | 'bare'

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
  /** Whether this is the currently-selected option in its group, for the
   * two-state variants: `toggle-pill`, `toggle-box`, `text-toggle`, `tab`,
   * `tab-display`, `menu-row` and `card`. Ignored by every other variant
   * (each of those is a single-state CTA role, not a selector). */
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
// GEN-2609-075 - sm/md/lg's padding/radius/font-size now read from the
// admin-controlled --afa-btn-padding-*/--afa-radius-*/--afa-text-*
// tokens (src/app/globals.css) instead of hardcoded numbers, so an
// admin edit in /dashboard/admin/design-system has a real, visible
// effect on this component - the whole point of this ticket's "live
// preview using the real Button component" requirement. `pill-sm`/
// `pill-md` deliberately keep their own literal padding/font-size
// (never audited/derived against the type scale the way sm/md/lg's
// 12/13/14px happen to line up 1:1 with --afa-text-small/-ui/-body) -
// only their radius moves to the shared --afa-radius-pill token, same
// as every other 999px pill shape in this file.
const SIZE_CHROME: Record<ButtonSizeToken, { padding: string; borderRadius: string; fontSize: string; fontWeight: number }> = {
  sm: { padding: 'var(--afa-btn-padding-sm)', borderRadius: 'var(--afa-radius-sm)', fontSize: 'var(--afa-text-small)', fontWeight: 600 },
  md: { padding: 'var(--afa-btn-padding-md)', borderRadius: 'var(--afa-radius-md)', fontSize: 'var(--afa-text-ui)', fontWeight: 600 },
  lg: { padding: 'var(--afa-btn-padding-lg)', borderRadius: 'var(--afa-radius-md)', fontSize: 'var(--afa-text-body)', fontWeight: 600 },
  'pill-sm': { padding: 'var(--afa-btn-padding-pill-sm)', borderRadius: 'var(--afa-radius-pill)', fontSize: 'var(--afa-text-ui)', fontWeight: 600 },
  'pill-md': { padding: 'var(--afa-btn-padding-pill-md)', borderRadius: 'var(--afa-radius-pill)', fontSize: 'var(--afa-text-body)', fontWeight: 600 },
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
  if (typeof size !== 'string') return base
  const chrome = SIZE_CHROME[size]
  // GEN-2609-110 - `tab` draws its selection as a bottom border, which a
  // corner radius would curl at both ends, so for it a size token moves
  // padding and type only.
  return variant === 'tab' ? { ...base, padding: chrome.padding, fontSize: chrome.fontSize } : { ...base, ...chrome }
}

function variantBaseStyle(variant: ButtonVariant, fullWidth: boolean, size: number | ButtonSizeToken, selected: boolean): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--afa-space-2)',
        width: fullWidth ? '100%' : undefined,
        background: 'var(--afa-fill-solid)',
        color: 'var(--afa-on-fill-solid)',
        padding: 'var(--afa-space-4)',
        border: 'none',
        borderRadius: 'var(--afa-radius-pill)',
        fontSize: 'var(--afa-text-title)',
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
        fontSize: 'var(--afa-text-ui)',
        fontFamily: FONT_FAMILY,
        padding: 'var(--afa-space-2) 0 0',
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
        fontSize: 'var(--afa-text-ui)',
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
        gap: 'var(--afa-space-2)',
        width: fullWidth ? '100%' : undefined,
        background: 'transparent',
        color: 'var(--afa-on-fill-solid)',
        padding: 'var(--afa-space-4)',
        border: '1.5px solid var(--afa-on-fill-solid)',
        borderRadius: 'var(--afa-radius-pill)',
        fontSize: 'var(--afa-text-title)',
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
        gap: 'var(--afa-space-6px)',
        width: fullWidth ? '100%' : undefined,
        background: 'transparent',
        color: 'var(--afa-text-secondary)',
        border: '1px solid var(--afa-border-resting)',
        // Own baseline chrome (not left to the `size` overlay alone) so
        // this renders sensibly even if a future caller omits `size` -
        // same defensive convention every other variant already follows.
        // A `size` token (this ticket always passes `sm`) overrides these.
        padding: 'var(--afa-btn-padding-sm)',
        borderRadius: 'var(--afa-radius-sm)',
        fontSize: 'var(--afa-text-small)',
        fontWeight: 600,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
        textDecoration: 'none',
      }
    case 'solid':
      // GEN-2609-076 - consolidates the "compact-save" shape found at
      // 16 real sites during the Button-coverage audit (settings x8,
      // artists, users, diary, design-system x2, seat-map x2) - same
      // --afa-fill-solid/--afa-on-fill-solid coloring as `primary`, but
      // `primary` bakes in a fixed 999px pill + uniform 16px sizing
      // none of these 16 sites actually use (they're all rounded-rects
      // at varying sizes). Sized via the EXISTING sm/md/lg SIZE_CHROME
      // scale rather than a new one - spec locked with Hitesh before
      // build, full per-site delta table in docs/design.md's
      // GEN-2609-076 entry (every site normalizes to fontWeight 600,
      // several had 700 - the one deliberate, documented drift here).
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--afa-space-2)',
        width: fullWidth ? '100%' : undefined,
        background: 'var(--afa-fill-solid)',
        color: 'var(--afa-on-fill-solid)',
        border: 'none',
        // md-shaped fallback if a caller omits `size` - same defensive
        // convention as outline-neutral/toggle-pill above.
        padding: 'var(--afa-btn-padding-md)',
        borderRadius: 'var(--afa-radius-md)',
        fontSize: 'var(--afa-text-ui)',
        fontWeight: 600,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
        textDecoration: 'none',
      }
    case 'outline-error':
      // GEN-2609-076 - consolidates the destructive-outline shape found
      // at 4 real sites (seat-map's Reset Layout/Remove image/Delete
      // seat/Delete marker) - error-red text/border on a raised-surface
      // fill, sized via the same sm/md/lg scale as `solid`. Admin
      // feedback's Approve/Reject buttons are a DIFFERENT color family
      // (green fill, translucent-red outline) and deliberately not
      // folded in here - see docs/design.md's GEN-2609-076 entry.
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--afa-space-2)',
        width: fullWidth ? '100%' : undefined,
        background: 'var(--afa-surface-raised)',
        color: 'var(--afa-error-bright)',
        border: '1px solid var(--afa-error)',
        padding: 'var(--afa-btn-padding-md)',
        borderRadius: 'var(--afa-radius-md)',
        fontSize: 'var(--afa-text-ui)',
        fontWeight: 600,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
        textDecoration: 'none',
      }
    case 'outline-accent':
      // GEN-2609-109 - the amber-outline family, 8 sites that were all
      // hand-styled `bare` (event +1 confirm, 2x admin Search submit,
      // organiser wallet credit, profile switch-role, tickets confirm-tag,
      // events "See all events", support "Send this to the team"). Their
      // borders drifted between full amber and 40%-alpha amber, 1px and
      // 1.5px - unified on a full-amber 1px border so it reads off the
      // one token. Same chrome and md fallback as `outline-error`.
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--afa-space-2)',
        width: fullWidth ? '100%' : undefined,
        background: 'transparent',
        color: 'var(--afa-amber)',
        border: '1px solid var(--afa-amber)',
        padding: 'var(--afa-btn-padding-md)',
        borderRadius: 'var(--afa-radius-md)',
        fontSize: 'var(--afa-text-ui)',
        fontWeight: 600,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
        textDecoration: 'none',
      }
    case 'success':
      // GEN-2609-109 - positive/approve actions, 5 `bare` sites (admin
      // feedback Approve, organiser Approve application, artist Accept tour
      // invite, organiser Publish Stop, messages Send). `solid`'s ember
      // fill reads as "the page's main CTA", not "approve", so these were
      // always a different colour family - see `outline-error`'s note on
      // GEN-2609-076 deliberately not folding them in. Text is
      // `--afa-cream`, not `--afa-on-fill-solid`: 3 of the 5 sites used
      // on-fill-solid (near-black #1A1000) on sage, which is ~3.0:1 contrast;
      // cream on sage is ~5.7:1, close to the white the messages Send button and
      // FeedbackDetailPanel's sage-selected pills already used.
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--afa-space-2)',
        width: fullWidth ? '100%' : undefined,
        background: 'var(--afa-sage)',
        color: 'var(--afa-cream)',
        border: 'none',
        padding: 'var(--afa-btn-padding-md)',
        borderRadius: 'var(--afa-radius-md)',
        fontSize: 'var(--afa-text-ui)',
        fontWeight: 600,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
        textDecoration: 'none',
      }
    case 'outline-success':
      // GEN-2609-109 - the outline counterpart of `success` (as
      // `outline-error` is to the destructive family): admin Unsuspend,
      // corporate-inquiry Mark Contacted, and the shared MessageButton.
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--afa-space-6px)',
        width: fullWidth ? '100%' : undefined,
        background: 'transparent',
        color: 'var(--afa-sage)',
        border: '1px solid var(--afa-sage)',
        padding: 'var(--afa-btn-padding-md)',
        borderRadius: 'var(--afa-radius-md)',
        fontSize: 'var(--afa-text-ui)',
        fontWeight: 600,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
        textDecoration: 'none',
      }
    case 'dashed':
      // GEN-2609-109 - the "+ Add ..." row, 6 `bare` sites (seat-map's
      // shared AddDashedRowButton, add level x2, add vertical aisle;
      // artist add tour stop; GA add section). Sites drew the dash at
      // 30%-alpha cream with 60%-opacity text; unified on the shared
      // resting-border token and text-secondary (65%), so an admin edit to
      // either reaches every add row.
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--afa-space-2)',
        width: fullWidth ? '100%' : undefined,
        background: 'transparent',
        color: 'var(--afa-text-secondary)',
        border: '1px dashed var(--afa-border-resting)',
        padding: 'var(--afa-btn-padding-sm)',
        borderRadius: 'var(--afa-radius-sm)',
        fontSize: 'var(--afa-text-small)',
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
      // GEN-2609-115 - text is `--afa-on-fill-solid`, the same as
      // `primary`: a deliberate AA fix, and a visible change (light text
      // becomes near-black). The earlier `--afa-cream` (standing in for
      // the call sites' old hardcoded white) measured 2.81:1 on
      // `--afa-fill-solid`, the only failing pair in the editor's
      // contrast panel; `--afa-on-fill-solid` is 6.05:1.
      return {
        display: 'block',
        width: fullWidth ? '100%' : undefined,
        background: 'var(--afa-fill-solid)',
        color: 'var(--afa-on-fill-solid)',
        padding: 'var(--afa-space-4)',
        border: 'none',
        borderRadius: 'var(--afa-radius-md)',
        fontSize: 'var(--afa-text-body-lg)',
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
        gap: 'var(--afa-space-6px)',
        width: fullWidth ? '100%' : undefined,
        background: selected ? FILL_SOLID_TINT : 'transparent',
        border: `1px solid ${selected ? FILL_SOLID_BORDER_TINT : 'var(--afa-border-resting)'}`,
        color: selected ? 'var(--afa-fill-solid)' : 'var(--afa-text-secondary)',
        // Own baseline chrome (same defensive convention as
        // `outline-neutral`) so this renders sensibly even if a future
        // caller omits `size` - callers should always pass `pill-sm`/
        // `pill-md` per the spec, this is only the fallback.
        padding: 'var(--afa-btn-padding-pill-sm)',
        borderRadius: 'var(--afa-radius-pill)',
        fontSize: 'var(--afa-text-ui)',
        fontWeight: 600,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
        textDecoration: 'none',
      }
    case 'toggle-box':
      // GEN-2609-110 - the box-shaped selector, 18 `bare` sites (seat-map
      // seating mode/level/wizard/alignment/placement toggles, organiser
      // compensation + approval mode, venue rate type x2, check-in list
      // filter, the seat picker + layout preview level switches). The
      // selected state is the 2px fill-solid border over the fill tint that
      // `toggle-pill`'s own comment calls the box-selector convention; the
      // resting border drifted between --afa-border-resting and
      // --afa-tint-20 and is unified on the former. Unlike `toggle-pill`
      // the border width changes on selection - that is how every one of
      // these sites already behaved. md fallback, same as `solid`.
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--afa-space-6px)',
        width: fullWidth ? '100%' : undefined,
        background: selected ? FILL_SOLID_TINT : 'var(--afa-surface-raised)',
        border: selected ? '2px solid var(--afa-fill-solid)' : '1px solid var(--afa-border-resting)',
        color: selected ? 'var(--afa-fill-solid)' : 'var(--afa-text-primary)',
        padding: 'var(--afa-btn-padding-md)',
        borderRadius: 'var(--afa-radius-md)',
        fontSize: 'var(--afa-text-ui)',
        fontWeight: 600,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
        textDecoration: 'none',
      }
    case 'text-link':
      // GEN-2609-110 - an inline underlined action inside a sentence or
      // under a field, 7 `bare` sites (register "Try more"/"Use ... instead",
      // admin "View note", seat-map "Back to setup options", venue sales
      // "Show top N", support "Use the feedback form"/"Remove"). Not `link`:
      // that is the full-width, centred, padded login link. Colour drifted
      // across amber, error-bright, secondary and muted; unified on amber,
      // the colour `link` and `secondary-reveal` already use for "this text
      // is an action".
      return {
        display: 'inline',
        background: 'transparent',
        border: 'none',
        padding: 0,
        color: 'var(--afa-amber)',
        fontSize: 'var(--afa-text-small)',
        fontWeight: 500,
        fontFamily: FONT_FAMILY,
        textDecoration: 'underline',
        cursor: 'pointer',
      }
    case 'text-toggle':
      // GEN-2609-110 - a text-only mono selector: selection is a colour
      // change, no box or underline. 7 `bare` sites (/events upcoming/past,
      // type and price filters; the locale codes in SiteNav and HomeHeader;
      // admin artists' sort headers). The resting colour and its hover come
      // from `.afa-btn-text-toggle` in globals.css (an inline colour can't
      // express :hover), so only the selected colour is set here.
      return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--afa-space-2)',
        width: fullWidth ? '100%' : undefined,
        background: 'transparent',
        border: 'none',
        padding: 0,
        color: selected ? 'var(--afa-amber)' : undefined,
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--afa-text-small)',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        cursor: 'pointer',
      }
    case 'tab':
      // GEN-2609-110 - an in-card tab: text over a 2px amber underline when
      // selected. 5 `bare` sites (artist profile About/Shows, the homepage
      // Near You card, the support widget's two panel tabs). Resting colour
      // + hover from `.afa-btn-tab` in globals.css, as for `text-toggle`.
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--afa-space-6px)',
        width: fullWidth ? '100%' : undefined,
        background: 'transparent',
        border: 'none',
        borderBottom: `2px solid ${selected ? 'var(--afa-amber)' : 'transparent'}`,
        color: selected ? 'var(--afa-text-primary)' : undefined,
        padding: 'var(--afa-btn-padding-md)',
        fontSize: 'var(--afa-text-ui)',
        fontWeight: 600,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
      }
    case 'tab-display':
      // GEN-2609-110 - the page-level tab set in the display face, 3 `bare`
      // sites (/events Events/Organisers, /venues Grid/Map). Same underline
      // as `tab`, but no side padding (the tabs sit flush on the page's
      // left edge) and the page-heading type. Resting colour + hover from
      // `.afa-btn-tab-display`. Inline-block, not flex: /venues puts a
      // superscript count after the label, and vertical-align needs
      // inline layout.
      return {
        display: 'inline-block',
        width: fullWidth ? '100%' : undefined,
        background: 'transparent',
        border: 'none',
        borderBottom: `2px solid ${selected ? 'var(--afa-amber)' : 'transparent'}`,
        color: selected ? 'var(--afa-text-primary)' : undefined,
        padding: '0 0 var(--afa-space-3)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--afa-text-lead)',
        fontWeight: 400,
        cursor: 'pointer',
      }
    case 'menu-row':
      // GEN-2609-110 - a full-width, left-aligned row in a dropdown, list or
      // menu, 16 `bare` sites (search results x3, browse dropdown, address
      // + city autocomplete, LocationChip's city list, /venues city filter
      // x2, language menus x2, account-menu Sign out x2, organiser invite
      // search x2, checkout companion search). The selected row takes the
      // amber wash (the language menus' existing treatment) with amber
      // text. `display: block`, not flex, so a row's inline spans keep
      // their spacing; a row that lays out two ends sets its own flex.
      // Hover comes from `.afa-btn-menu-row` in globals.css, which is why
      // the resting background is left unset here.
      return {
        display: 'block',
        width: fullWidth ? '100%' : undefined,
        textAlign: 'left',
        background: selected ? 'var(--afa-amber-wash)' : undefined,
        border: 'none',
        color: selected ? 'var(--afa-amber)' : 'var(--afa-text-primary)',
        padding: 'var(--afa-btn-padding-md)',
        borderRadius: 'var(--afa-radius-sm)',
        fontSize: 'var(--afa-text-body)',
        fontWeight: selected ? 600 : 400,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
        textDecoration: 'none',
      }
    case 'disclosure':
      // GEN-2609-110 - a compact "> Section (n)" show/hide toggle, the 4
      // `bare` sites on admin feedback. Was text-primary at 70% opacity;
      // --afa-text-secondary is the same alpha family at 65%, as a token.
      return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--afa-space-6px)',
        width: fullWidth ? '100%' : undefined,
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        padding: 0,
        color: 'var(--afa-text-secondary)',
        fontSize: 'var(--afa-text-small)',
        fontWeight: 700,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
      }
    case 'card':
      // GEN-2609-110 - a whole card as the click target, 4 `bare` sites
      // (seat-map's two setup-path cards, venue create's path cards,
      // /my-feedback items). Raised surface, radius-lg, 20px padding;
      // `selected` is the chosen (or recommended) path. Content layout
      // stays the caller's own children.
      return {
        display: 'block',
        width: fullWidth ? '100%' : undefined,
        textAlign: 'left',
        background: selected ? FILL_SOLID_TINT : 'var(--afa-surface-raised)',
        border: `1px solid ${selected ? 'var(--afa-fill-solid)' : 'var(--afa-tint-12)'}`,
        color: 'var(--afa-text-primary)',
        padding: 'var(--afa-space-5)',
        borderRadius: 'var(--afa-radius-lg)',
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
        textDecoration: 'none',
      }
    case 'scrim':
      // GEN-2609-110 - the click-to-dismiss backdrop behind a sheet or
      // modal, 3 `bare` sites (FeeSheet, ContributionMoment, the /events
      // filter sheet). Fills its positioned parent; the caller passes an
      // aria-label and `{null}` children.
      return {
        position: 'absolute',
        inset: 0,
        background: 'var(--afa-scrim)',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
      }
    case 'link':
      // GEN-2609-096 - Class B: the one real 3+-site exact-match shape
      // found in the raw-<button> audit (docs/button-adoption-audit.md)
      // - login's "use OTP instead"/"use password instead"/"resend
      // code" + RegisterForm's "resend code", byte-identical style at
      // all 4 sites before this migration.
      return {
        width: '100%',
        background: 'transparent',
        color: 'var(--afa-amber)',
        padding: 'var(--afa-space-3)',
        borderRadius: 'var(--afa-radius-md)',
        border: 'none',
        fontSize: 'var(--afa-text-ui)',
        fontWeight: 500,
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
      }
    case 'icon':
      // GEN-2609-096 - Class C: icon-only controls (password show/hide,
      // close/dismiss, prev/next, notify-bell, zoom, search/menu/
      // language toggles, drag handle, save/bookmark toggle - 43 sites,
      // see the audit doc). Deliberately a plain ghost reset, not a
      // fixed circle/fill the way `close` is - every real site already
      // carries its own width/height/background/border via its own
      // `style` prop (which always wins, merged after this), so this
      // variant's only real job is the shared fontFamily/cursor/
      // color:inherit reset plus flex-centering the icon child. Never
      // reads `size` as a diameter the way `close` does - a caller that
      // wants a fixed footprint still sets it explicitly via `style`,
      // same as every one of the 43 real sites already does.
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        color: 'inherit',
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
      }
    case 'bare':
      // GEN-2609-096 - Class D: structural/one-off raw buttons (162
      // sites, see the audit doc) whose look is the caller's own -
      // list rows, tabs, filter chips, status pills, dashed "add" rows,
      // disclosure toggles, etc. Reset-only, per the dispatch's own
      // spec: fontFamily (the GEN-2609-028 bug this whole file's header
      // comment already documents - a raw <button> never inherits
      // font-family from its ancestors), background/border cleared so
      // a caller's own `style` starts from a truly blank slate instead
      // of fighting the browser's default button chrome, cursor, and
      // color:inherit so text color still flows from the caller's own
      // wrapping context by default. Every real site already supplies
      // its own full `style` object, which is merged in after this and
      // wins on every property it sets - this reset only ever fills a
      // gap a site's own style doesn't already cover.
      return {
        fontFamily: FONT_FAMILY,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'inherit',
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
        borderRadius: '50%', // token-ok: geometric circle, not a design-scale radius choice
        flexShrink: 0,
        background: 'var(--afa-tint-08)',
        color: 'var(--afa-text-secondary)',
        border: 'none',
        fontSize: 'var(--afa-text-title)',
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
      }
    }
  }
}

export default function Button(props: ButtonProps) {
  const { variant, children, fullWidth = true, size = 36, selected = false, icon, style, className: callerClassName } = props
  // GEN-2609-110 - `afa-btn` carries the shared focus-visible ring and
  // `afa-btn-<variant>` any :hover a variant needs (globals.css) - states
  // an inline style can't express.
  const className = ['afa-btn', `afa-btn-${variant}`, callerClassName].filter(Boolean).join(' ')
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
