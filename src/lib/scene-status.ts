import prisma from "@/lib/prisma"
import { getPlatformSettings } from "@/lib/platform-settings"

// ---------------------------------------------------------------------------
// Scene Status (reputation epic §1, renamed from "Reputation Tier" per
// session 53, mechanics finalized session 55 — see
// docs/artist-reputation-system-design.md Amendment 1).
//
// Four tiers, live-computed on every read (session 53 decision — same
// architectural choice as Verified/Repeat Attendee counts, no cache/batch):
//   NEW_EMERGING — default, no badge
//   RISING       — automatic: gigs + avg rating + attendees, all
//                  PlatformSettings-configurable thresholds (not hardcoded,
//                  deliberately — the source design doc itself says the
//                  formula is "TBD once we see real data volume")
//   FEATURED     — semi-automatic: distinct-organiser Featured-vouch count
//                  (Performance.isFeaturedVouch) crosses a configurable
//                  threshold. Distinct organisers, not raw vouch count, so
//                  one organiser can't single-handedly promote an artist by
//                  repeat-booking them.
//   HEADLINER    — fully manual, admin-only (Artist.isSceneStatusHeadliner).
//                  Deliberately no formula/config/automation — "not a small
//                  thing to get, it's supposed to be earned" (Hitesh,
//                  session 55). Admin weighs whatever signals they judge
//                  relevant directly.
//
// Precedence when multiple thresholds are technically crossed: Headliner >
// Featured > Rising > New/Emerging — a manually-earned Headliner or
// organiser-vouched Featured always outranks an auto-computed Rising.
// ---------------------------------------------------------------------------

export type SceneStatusTier = "NEW_EMERGING" | "RISING" | "FEATURED" | "HEADLINER"

export const SCENE_STATUS_LABEL: Record<SceneStatusTier, string> = {
  NEW_EMERGING: "New / Emerging",
  RISING: "Rising",
  FEATURED: "Featured",
  HEADLINER: "Headliner",
}

/**
 * Computes Scene Status for a single artist. Does its own queries — fine
 * for single-artist contexts (artist profile page). For a lineup of several
 * artists (e.g. the organiser poster route), prefer getSceneStatusBatch to
 * avoid N separate round trips per artist.
 */
export async function getSceneStatus(artistId: string): Promise<SceneStatusTier> {
  const result = await getSceneStatusBatch([artistId])
  return result.get(artistId) ?? "NEW_EMERGING"
}

/**
 * Batch version — one settings read, then per-artist queries done with
 * Promise.all rather than sequentially. Real batching (single groupBy
 * query across all artistIds) would be the next optimization if this ever
 * sits on a hot path with large lineups; not needed at current typical
 * lineup sizes (a handful of performers per event).
 */
export async function getSceneStatusBatch(artistIds: string[]): Promise<Map<string, SceneStatusTier>> {
  const result = new Map<string, SceneStatusTier>()
  if (artistIds.length === 0) return result

  const settings = await getPlatformSettings()

  const artists = await prisma.artist.findMany({
    where: { id: { in: artistIds } },
    select: { id: true, isSceneStatusHeadliner: true },
  })
  const headlinerById = new Map(artists.map((a: { id: string; isSceneStatusHeadliner: boolean }) => [a.id, a.isSceneStatusHeadliner]))

  await Promise.all(
    artistIds.map(async (artistId) => {
      if (headlinerById.get(artistId)) {
        result.set(artistId, "HEADLINER")
        return
      }

      const performances = await prisma.performance.findMany({
        where: { artistId, cancelledAt: null },
        select: { id: true, eventId: true, isFeaturedVouch: true, event: { select: { organiserId: true } } },
      })

      type PerformanceRow = { id: string; eventId: string; isFeaturedVouch: boolean; event: { organiserId: string } }
      const featuredOrganiserIds = new Set(
        (performances as PerformanceRow[]).filter((p) => p.isFeaturedVouch).map((p) => p.event.organiserId)
      )
      if (featuredOrganiserIds.size >= settings.sceneStatusFeaturedVouchThreshold) {
        result.set(artistId, "FEATURED")
        return
      }

      const gigCount = performances.length

      const reviewAgg = await prisma.review.aggregate({
        where: { performanceId: { in: (performances as PerformanceRow[]).map((p) => p.id) } },
        _avg: { rating: true },
      })
      const avgRating = reviewAgg._avg.rating

      // Verified Attendees (§3) — distinct checked-in accounts across all
      // events this artist performed at. Same logic as the artist profile
      // page's own computation (kept in sync deliberately, not imported
      // directly, since that page also needs repeatAttendees split out for
      // display — this only needs the total count for the Rising check).
      const eventIds = [...new Set((performances as PerformanceRow[]).map((p) => p.eventId))]
      const verifiedAttendeeCount = eventIds.length
        ? (
            await prisma.booking.findMany({
              where: { eventId: { in: eventIds }, status: "CONFIRMED", checkedInAt: { not: null } },
              select: { userId: true },
              distinct: ["userId"],
            })
          ).length
        : 0

      const meetsRising =
        gigCount >= settings.sceneStatusRisingMinGigs &&
        avgRating !== null &&
        avgRating >= settings.sceneStatusRisingMinAvgRating &&
        verifiedAttendeeCount >= settings.sceneStatusRisingMinAttendees

      result.set(artistId, meetsRising ? "RISING" : "NEW_EMERGING")
    })
  )

  return result
}
