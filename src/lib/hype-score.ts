import { getEventEndDateTime } from "@/lib/eventTime"

// ---------------------------------------------------------------------------
// Hype Score (reputation epic §4) - per-show, fast-moving, live-computed.
// Extracted from src/app/(public)/events/[id]/page.tsx (session 56) so the
// admin artist roster (src/app/api/admin/artists/route.ts) can reuse the
// exact same eligibility rule rather than re-deriving it - single source of
// truth, same reasoning getEventEndDateTime itself already documents for
// the show-end anchor instant.
//
// Score only surfaces once the show has been over for HYPE_SCORE_WINDOW_HOURS
// (early partial averages right after doors-close are noisy) AND there are
// at least HYPE_SCORE_MIN_REVIEWS reviews (a single 5-star from a friend
// shouldn't read as a score).
// ---------------------------------------------------------------------------

export const HYPE_SCORE_WINDOW_HOURS = 2
export const HYPE_SCORE_MIN_REVIEWS = 5

export function computeHypeScore(
  event: { date: Date; startTime: string; endTime: string },
  reviews: { rating: number | null }[]
): number | null {
  const eligibleFrom = new Date(getEventEndDateTime(event).getTime() + HYPE_SCORE_WINDOW_HOURS * 60 * 60 * 1000)
  const eligible = Date.now() >= eligibleFrom.getTime()
  const ratedReviews = reviews.filter((r): r is { rating: number } => r.rating != null)
  if (!eligible || ratedReviews.length < HYPE_SCORE_MIN_REVIEWS) return null
  return Math.round((ratedReviews.reduce((sum, r) => sum + r.rating, 0) / ratedReviews.length) * 10) / 10
}
