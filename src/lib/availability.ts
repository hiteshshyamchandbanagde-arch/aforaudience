// Shared "how full is this event" status, used on the events listing
// cards and the event detail page so both stay in sync on the same
// definition rather than each hand-rolling their own threshold.
//
// From live feedback (19 Jul) - Hitesh asked for a clearer "filling
// fast / spots available / sold out" signal. The listing page already
// had an ad-hoc "< 10 seats left" badge with no sold-out state at all
// (a sold-out event would confusingly show "0 seats left" under the
// fire emoji). This replaces that with a proper ratio-based status
// that also handles sold-out explicitly.

export type AvailabilityStatus = 'available' | 'filling-fast' | 'sold-out'

// 15% remaining is the "filling fast" cutoff - roughly matches the
// gut-check organisers already use ("call it close to full"), and
// scales correctly for both a 20-seat open mic and a 250-seat theatre
// (unlike a fixed "<10 seats" threshold, which never fires for a large
// venue until it's nearly full in absolute terms only).
const FILLING_FAST_RATIO = 0.15

export function getAvailabilityStatus(totalSeats: number, availableSeats: number): AvailabilityStatus {
  if (availableSeats <= 0) return 'sold-out'
  if (totalSeats > 0 && availableSeats / totalSeats <= FILLING_FAST_RATIO) return 'filling-fast'
  return 'available'
}

// GEN-2609-067 - `filling-fast` used to hardcode `--afa-red-alt`
// (#EF4444), a second, independent "error red" alongside
// `STATUS_TONE.error`'s `--afa-error` (#B3261E) - two reds doing the
// same semantic job. Not a literal `STATUS_TONE.error` import though:
// this badge is a real domain mismatch with `STATUS_TONE`'s own
// convention (a bold, solid, high-urgency badge - "seats running out,
// act now" - vs `STATUS_TONE`'s subtle translucent-tint pills used for
// admin/dashboard status labels). Keeping the solid-badge shape but
// pointing it at the app's one real error red (`--afa-error`) closes
// the duplicate-token gap without forcing a visual-weight change that
// would blunt the urgency this badge exists for.
// `sold-out` had the same class of bug in miniature: `--afa-ink`/
// `--afa-white` are the legacy light-theme palette - `--afa-ink` is
// barely distinguishable from the page's own dark background, and
// literal white doesn't match the app's established "light text on a
// dark solid" token (`--afa-cream`). Swapped to keep the same solid-
// badge look with tokens that are actually visible and named for their
// role in the current dark theme.
export const AVAILABILITY_BADGE: Record<AvailabilityStatus, { label: string; bg: string; color: string }> = {
  'sold-out': { label: 'Sold Out', bg: 'var(--afa-brown-black)', color: 'var(--afa-cream)' },
  'filling-fast': { label: 'Filling Fast', bg: 'var(--afa-error)', color: 'var(--afa-cream)' },
  available: { label: 'Spots Available', bg: 'rgba(74,103,65,0.12)', color: 'var(--afa-sage)' },
}
