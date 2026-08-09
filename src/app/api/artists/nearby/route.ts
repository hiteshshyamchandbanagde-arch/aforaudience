import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/artists/nearby?city=X&limit=4
//
// Purpose-built for the homepage "Artists near you" rail (GEN-2608-032
// hero-row split - pairs with TonightNearYou / /api/events/upcoming).
//
// Artist has no home-city field on its own model, so "near you" is
// defined the same way the events rail defines "tonight": artists with
// an upcoming APPROVED-event performance at a venue in the visitor's
// city, ordered by how soon that performance is. Same
// city-optional / soonest-anywhere fallback as /api/events/upcoming so
// the rail is never empty just because we don't know the visitor's
// city yet.
//
// One row per artist (first/soonest upcoming performance only) even if
// an artist has multiple upcoming slots in-window - this is a "who's
// performing soon" teaser, not a full lineup listing.

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const city = searchParams.get('city')?.trim() || null
    const limitParam = parseInt(searchParams.get('limit') || '4', 10)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 10) : 4

    const now = new Date()
    const baseWhere = {
      cancelledAt: null,
      event: {
        status: 'APPROVED' as const,
        date: { gte: now },
        organiser: { user: { isSuspended: false } },
      },
    }

    async function fetchPerformances(withCity: string | null) {
      const rows = await prisma.performance.findMany({
        where: withCity
          ? { ...baseWhere, event: { ...baseWhere.event, venue: { city: withCity } } }
          : baseWhere,
        select: {
          artist: {
            select: {
              id: true,
              genre: true,
              isSceneStatusHeadliner: true,
              user: { select: { displayName: true, name: true, avatar: true } },
            },
          },
          event: {
            select: {
              date: true,
              startTime: true,
              type: true,
              venue: { select: { city: true } },
            },
          },
        },
        orderBy: { event: { date: 'asc' } },
        take: limit * 3, // over-fetch, since multiple slots can share an artist
      })

      // Dedupe to one (soonest) performance per artist, preserving order.
      const seen = new Set<string>()
      const deduped: typeof rows = []
      for (const row of rows) {
        if (seen.has(row.artist.id)) continue
        seen.add(row.artist.id)
        deduped.push(row)
        if (deduped.length >= limit) break
      }
      return deduped
    }

    let performances = city ? await fetchPerformances(city) : []

    if (performances.length === 0) {
      performances = await fetchPerformances(null)
    }

    const artists = performances.map((row: (typeof performances)[number]) => ({
      id: row.artist.id,
      name: row.artist.user.displayName || row.artist.user.name,
      avatar: row.artist.user.avatar,
      genre: row.artist.genre?.[0] || null,
      isSceneStatusHeadliner: row.artist.isSceneStatusHeadliner,
      eventDate: row.event.date,
      eventStartTime: row.event.startTime,
      eventType: row.event.type,
      city: row.event.venue?.city || null,
    }))

    return NextResponse.json({
      artists,
      matchedCity: city && artists.some((a: { city: string | null }) => a.city === city) ? city : null,
    })
  } catch (err) {
    console.error('GET /api/artists/nearby error', err)
    return NextResponse.json({ artists: [], matchedCity: null }, { status: 200 })
  }
}
