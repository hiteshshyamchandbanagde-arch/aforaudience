import prisma from '@/lib/prisma'

// Tour by Organiser (12 Aug). Small shared helpers so the slug/status
// logic lives in one place instead of being duplicated across the Tour
// CRUD, stop-lineup, and consent-response routes.

/**
 * Turns a Tour title into a URL-safe slug, appending a short random
 * suffix to guarantee uniqueness without a retry-loop against the DB for
 * the common case (collisions on the base slug are checked anyway below,
 * this just makes them rare).
 */
export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base || 'tour'}-${suffix}`
}

/**
 * Generates a unique Tour slug, retrying with a fresh random suffix on
 * the rare collision (unique index on Tour.slug is the real guarantee -
 * this just avoids surfacing a 500 to the organiser on the 1-in-a-
 * few-million case).
 */
export async function generateUniqueTourSlug(title: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = slugify(title)
    const existing = await prisma.tour.findUnique({ where: { slug: candidate } })
    if (!existing) return candidate
  }
  // Last resort - timestamp is guaranteed unique.
  return `${slugify(title)}-${Date.now()}`
}

/**
 * A Tour Stop (Event with category TOUR_STOP) is bookable/publishable
 * only once every artist currently in ITS OWN fixed lineup (active
 * Performance rows) has an ACCEPTED TourArtistConsent for that Tour.
 * Deliberately scoped to this one event's lineup, not the whole Tour -
 * an outstanding invite on a different stop must never block this one
 * (Hitesh, 12 Aug: "organiser can drop that artist and re-invite
 * someone else, rest proceeds").
 */
export async function isTourStopBookable(eventId: string): Promise<{ ok: boolean; pendingArtistIds: string[] }> {
  const performances = await prisma.performance.findMany({
    where: { eventId, cancelledAt: null },
    select: { artistId: true },
  })
  if (performances.length === 0) {
    // No fixed lineup at all (e.g. open-slots-only stop) - nothing to
    // wait on.
    return { ok: true, pendingArtistIds: [] }
  }
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { tourId: true } })
  if (!event?.tourId) return { ok: true, pendingArtistIds: [] }

  const artistIds: string[] = [...new Set<string>(performances.map((p: { artistId: string }) => p.artistId))]
  const consents = await prisma.tourArtistConsent.findMany({
    where: { tourId: event.tourId, artistId: { in: artistIds } },
  })
  const acceptedIds = new Set<string>(
    consents.filter((c: { status: string }) => c.status === 'ACCEPTED').map((c: { artistId: string }) => c.artistId)
  )
  const pendingArtistIds: string[] = artistIds.filter((id: string) => !acceptedIds.has(id))
  return { ok: pendingArtistIds.length === 0, pendingArtistIds }
}

/**
 * Recomputes and persists Tour.status from current consent/stop state.
 * Called after anything that could change it (consent response, lineup
 * add/remove, stop publish). Deliberately synchronous/on-write rather
 * than a background job - the counts involved are always small (one
 * organiser's tour, a handful of stops/artists).
 *
 * DRAFT: organiser hasn't sent any consent invites yet.
 * PENDING_CONSENT: at least one artist invite is still outstanding.
 * LIVE: no outstanding invites AND at least one stop is actually
 *   APPROVED (bookable) - a Tour where every artist accepted but the
 *   organiser hasn't published any stop yet stays DRAFT, since nothing
 *   is live for the audience.
 * CANCELLED/COMPLETED are terminal and never overwritten here.
 */
export async function recomputeTourStatus(tourId: string): Promise<void> {
  const tour = await prisma.tour.findUnique({ where: { id: tourId } })
  if (!tour || tour.status === 'CANCELLED' || tour.status === 'COMPLETED') return

  const [pendingCount, approvedStopCount] = await Promise.all([
    prisma.tourArtistConsent.count({ where: { tourId, status: 'PENDING' } }),
    prisma.event.count({ where: { tourId, status: 'APPROVED' } }),
  ])

  let nextStatus: 'DRAFT' | 'PENDING_CONSENT' | 'LIVE'
  if (pendingCount > 0) {
    nextStatus = 'PENDING_CONSENT'
  } else if (approvedStopCount > 0) {
    nextStatus = 'LIVE'
  } else {
    nextStatus = 'DRAFT'
  }

  if (nextStatus !== tour.status) {
    await prisma.tour.update({ where: { id: tourId }, data: { status: nextStatus } })
  }
}
