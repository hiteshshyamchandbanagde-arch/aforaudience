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
 * Batch version — fixed number of DB round trips (settings, headliner
 * flags, performances, reviews, bookings — five total) regardless of how
 * many artistIds are passed, instead of doing N separate per-artist
 * queries. Originally per-artist (see git history) on the assumption this
 * would only ever run against small lineups (a handful of performers per
 * event/poster) - that assumption broke the moment it got wired into the
 * public /artists listing page (up to ~100 artists at once): with the
 * Postgres pool capped to a single connection (src/lib/prisma.ts), N
 * per-artist queries serialize into N sequential round trips rather than
 * running in parallel despite Promise.all, which measured as a 10-30s
 * page load live on QA. Rewritten to real batching - same tier logic and
 * precedence, just computed from three bulk queries grouped in memory
 * instead of one query per artist.
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

  const nonHeadlinerIds = artistIds.filter((id) => !headlinerById.get(id))
  for (const id of artistIds) {
    if (headlinerById.get(id)) result.set(id, "HEADLINER")
  }
  if (nonHeadlinerIds.length === 0) return result

  // One query for every performance across every non-Headliner artist,
  // instead of one query per artist.
  const performances = await prisma.performance.findMany({
    where: { artistId: { in: nonHeadlinerIds }, cancelledAt: null },
    select: { id: true, artistId: true, eventId: true, isFeaturedVouch: true, event: { select: { organiserId: true } } },
  })
  type PerformanceRow = { id: string; artistId: string; eventId: string; isFeaturedVouch: boolean; event: { organiserId: string } }
  const performancesByArtist = new Map<string, PerformanceRow[]>()
  for (const p of performances as PerformanceRow[]) {
    const list = performancesByArtist.get(p.artistId) ?? []
    list.push(p)
    performancesByArtist.set(p.artistId, list)
  }

  const allPerformanceIds = (performances as PerformanceRow[]).map((p) => p.id)
  const allEventIds = [...new Set((performances as PerformanceRow[]).map((p) => p.eventId))]

  // One query for every review row across every performance, instead of
  // one aggregate query per artist. Averaged per-artist in memory below.
  const reviews = allPerformanceIds.length
    ? await prisma.review.findMany({
        where: { performanceId: { in: allPerformanceIds } },
        select: { performanceId: true, rating: true },
      })
    : []
  const performanceIdToArtistId = new Map((performances as PerformanceRow[]).map((p) => [p.id, p.artistId]))
  const ratingsByArtist = new Map<string, number[]>()
  for (const r of reviews as { performanceId: string | null; rating: number }[]) {
    if (!r.performanceId) continue
    const artistId = performanceIdToArtistId.get(r.performanceId)
    if (!artistId) continue
    const list = ratingsByArtist.get(artistId) ?? []
    list.push(r.rating)
    ratingsByArtist.set(artistId, list)
  }

  // One query for every checked-in booking across every event any of
  // these artists performed at, instead of one query per artist. Same
  // distinct-user logic as §3 (Verified Attendees), just computed once
  // for the whole batch and sliced per-artist by their own eventIds.
  const checkedInBookings = allEventIds.length
    ? await prisma.booking.findMany({
        where: { eventId: { in: allEventIds }, status: "CONFIRMED", checkedInAt: { not: null } },
        select: { eventId: true, userId: true },
      })
    : []
  const userIdsByEvent = new Map<string, Set<string>>()
  for (const b of checkedInBookings as { eventId: string; userId: string }[]) {
    const set = userIdsByEvent.get(b.eventId) ?? new Set<string>()
    set.add(b.userId)
    userIdsByEvent.set(b.eventId, set)
  }

  for (const artistId of nonHeadlinerIds) {
    const artistPerformances = performancesByArtist.get(artistId) ?? []

    const featuredOrganiserIds = new Set(artistPerformances.filter((p) => p.isFeaturedVouch).map((p) => p.event.organiserId))
    if (featuredOrganiserIds.size >= settings.sceneStatusFeaturedVouchThreshold) {
      result.set(artistId, "FEATURED")
      continue
    }

    const gigCount = artistPerformances.length
    const ratings = ratingsByArtist.get(artistId) ?? []
    const avgRating = ratings.length ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null

    const artistEventIds = [...new Set(artistPerformances.map((p) => p.eventId))]
    const verifiedAttendeeIds = new Set<string>()
    for (const eventId of artistEventIds) {
      for (const userId of userIdsByEvent.get(eventId) ?? []) verifiedAttendeeIds.add(userId)
    }

    const meetsRising =
      gigCount >= settings.sceneStatusRisingMinGigs &&
      avgRating !== null &&
      avgRating >= settings.sceneStatusRisingMinAvgRating &&
      verifiedAttendeeIds.size >= settings.sceneStatusRisingMinAttendees

    result.set(artistId, meetsRising ? "RISING" : "NEW_EMERGING")
  }

  return result
}
