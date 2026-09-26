// GEN-2609-051 - the 4 bg/color pairs below were independently
// duplicated, byte-for-byte, across tickets/page.tsx's booking-status
// badges (PENDING/EXPIRED/CONFIRMED/CANCELLED/REFUNDED) and
// dashboard/organiser/page.tsx's event-status badges (DRAFT/APPROVED/
// PENDING_APPROVAL/CANCELLED/COMPLETED).
//
// The two pages' own status keys don't actually map onto each other -
// a booking's lifecycle and an event's are different domains (there is
// no "CONFIRMED" event status, no "DRAFT" booking status) - so this
// deliberately does NOT export one shared status->style table for both
// pages to import wholesale. What's genuinely shared is the underlying
// 4-tone visual language (gold/sage/error/muted) both domains draw the
// exact same values from; each page still owns its own STATUS_STYLE
// object keyed by its own real statuses, built from these tones instead
// of re-typing the literal rgba/token pairs.
//
// Scoped to exactly the two files GEN-2609-051 named - several other
// status-badge objects elsewhere in the app (dashboard/artist/page.tsx's
// APPLICATION_STYLE, dashboard/organiser/tours/page.tsx, etc.) reuse the
// same tones too but are out of scope for this pass.
export interface StatusToneStyle {
  bg: string
  color: string
}

// GEN-2609-063 - `orange` added for the DECLINED-status ternary in
// organiser/events/[id]/edit/page.tsx (both the lineup-consent and
// panel-invite lists), previously a raw `--afa-terracotta`/
// `rgba(200,68,26,0.1)` literal pair, not routed through this file at
// all. Value carries forward the terracotta->fill-solid retarget
// (same reasoning as the rest of the repo-wide sweep this ticket did) -
// not a redesign of the ACCEPTED/DECLINED/PENDING color scheme itself,
// which stays sage/orange/gold exactly as before.
// GEN-2609-068 - `sage`/`error`'s `color` moved to the new
// `--afa-sage-bright`/`--afa-error-bright` tokens (globals.css) instead
// of the base `--afa-sage`/`--afa-error` hues: the base hues fail WCAG
// AA against these tones' own translucent `bg` (verified, not eyeballed
// - see HANDOFF.md's GEN-2609-068 entry for the full contrast-math
// trail). Every consumer of STATUS_TONE.sage/.error gets the legible
// text color automatically - this was never a per-page bug, it was the
// shared tone definition itself.
export const STATUS_TONE: Record<'gold' | 'sage' | 'error' | 'muted' | 'orange', StatusToneStyle> = {
  gold: { bg: 'rgba(201,151,58,0.15)', color: 'var(--afa-amber)' },
  sage: { bg: 'rgba(74,103,65,0.12)', color: 'var(--afa-sage-bright)' },
  error: { bg: 'rgba(179,38,30,0.1)', color: 'var(--afa-error-bright)' },
  muted: { bg: 'rgba(245,245,240,0.08)', color: 'var(--afa-text-primary)' },
  orange: { bg: 'rgba(255,90,54,0.1)', color: 'var(--afa-fill-solid)' },
}

// GEN-2609-063 - `--afa-fill-solid` has no CSS-level "-tint" companion
// (unlike the legacy `--afa-terracotta-tint`, an opaque light color from
// the pre-dark-theme palette that doesn't suit today's dark surfaces).
// Every selected/active-state translucent overlay this ticket's repo-
// wide sweep touched independently re-typed the same fill-solid RGB
// triple (255,90,54) at its own alpha - centralized here (this file is
// already the design-tokens check's exempt "shared tone source," same
// reasoning as STATUS_TONE above) rather than leaving 6 files with a
// brand-new hardcoded literal apiece.
export const FILL_SOLID_TINT = 'rgba(255,90,54,0.08)'
export const FILL_SOLID_BORDER_TINT = 'rgba(255,90,54,0.25)'

// A handful of sites needed a one-off alpha (0.12, 0.15, ...) rather
// than the two common ones above - a function call instead of another
// named constant per alpha value, since the actual set of alphas in use
// isn't fixed or meaningful on its own (unlike STATUS_TONE's palette).
export function fillSolidTint(alpha: number): string {
  return `rgba(255,90,54,${alpha})`
}
