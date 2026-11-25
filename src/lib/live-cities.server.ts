import { unstable_cache } from "next/cache"
import prisma from "@/lib/prisma"
import { liveCityNames } from "@/lib/live-cities"

// Events copy A (Hitesh, 14 Oct) - the DB half of the home hero's live
// city count. Import only from Server Components (same split as
// design-tokens.server.ts). The rule itself is live-cities.ts.

async function fetchLiveCities(): Promise<string[]> {
  // A day of slack on the date column; liveCityNames does the exact
  // date+startTime cut. Only APPROVED shows at an approved venue (the
  // venues behind /api/venues/cities, so a "real listed city").
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const events = await prisma.event.findMany({
    where: { status: "APPROVED", date: { gte: since }, venue: { isApproved: true } },
    select: { date: true, startTime: true, venue: { select: { city: true } } },
  })
  return liveCityNames(events, new Date())
}

// A few minutes stale at most: one small read per 5 minutes per cache,
// and only when the homepage is actually requested.
const LIVE_CITIES_CACHE_SECONDS = 300
const getCachedLiveCities = unstable_cache(fetchLiveCities, ["live-cities-v1"], {
  revalidate: LIVE_CITIES_CACHE_SECONDS,
})

// Never throws: if the DB can't be read the tag is simply hidden.
export async function getLiveCitiesSafe(): Promise<string[]> {
  try {
    return await getCachedLiveCities()
  } catch (err) {
    console.warn("[live-cities] read failed, hiding the hero tag", err)
    return []
  }
}
