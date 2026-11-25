import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getSceneStatusBatch } from '@/lib/scene-status'
import { computeHypeScore } from '@/lib/hype-score'
import { getPlatformSettings } from '@/lib/platform-settings'

// GET /api/admin/artists — admin-only. Powers /dashboard/admin/artists,
// session 56 - Hitesh: "artist will be displayed based on configuration...
// no of gigs performed, hype score, how long in scene, organiser average
// rating, poll result, etc." Poll result (Audience Choice, §6) isn't built
// yet (step 9 of the epic) - column omitted until that lands, not stubbed
// with fake data.
//
// Admin-only surface, so this is one of the few places OrganiserArtistRating
// is legitimately readable - the design doc's "never shown publicly" rule
// is about public/audience visibility, not admin oversight; admin seeing
// it is literally the field's stated purpose (feeds tier calculation).
//
// No pagination beyond a hard limit, matching /api/admin/users' own
// convention - fine at current QA volume, revisit if that changes.

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  return user?.role === 'ADMIN' ? user : null
}

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim()

    const settings = await getPlatformSettings()

    const artists = await prisma.artist.findMany({
      where: search
        ? {
            OR: [
              { user: { name: { contains: search, mode: 'insensitive' } } },
              { user: { displayName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : undefined,
      select: {
        id: true,
        isSceneStatusHeadliner: true,
        headlinerNote: true,
        user: { select: { name: true, displayName: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    type ArtistListItem = {
      id: string
      isSceneStatusHeadliner: boolean
      headlinerNote: string | null
      user: { name: string; displayName: string | null; avatar: string | null }
    }

    const artistIds = (artists as ArtistListItem[]).map((a) => a.id)
    const sceneStatusById = await getSceneStatusBatch(artistIds)

    // Feedback (2 Aug) - Artist Roster took 30+ seconds to load. Root
    // cause: identical N+1 shape to the /artists slowdown fixed in
    // PR #311 - a Promise.all wrapping up to 3 sequential DB queries
    // PER artist (up to 200 artists x up to 3 queries = up to 600
    // round trips), serialized hard against the connection pool cap.
    // Rewritten to a fixed small number of batch queries regardless of
    // roster size, with all aggregation done in memory afterward.

    const allPerfs = artistIds.length
      ? await prisma.performance.findMany({
          where: { artistId: { in: artistIds }, cancelledAt: null },
          select: {
            artistId: true,
            eventId: true,
            event: { select: { date: true, startTime: true, endTime: true, organiserId: true } },
            reviews: { select: { rating: true } },
            isFeaturedVouch: true,
          },
          orderBy: { event: { date: 'desc' } },
        })
      : []

    type PerfRow = {
      artistId: string
      eventId: string
      event: { date: Date; startTime: string; endTime: string; organiserId: string }
      reviews: { rating: number | null }[]
      isFeaturedVouch: boolean
    }
    const perfsByArtist = new Map<string, PerfRow[]>()
    for (const p of allPerfs as PerfRow[]) {
      if (!perfsByArtist.has(p.artistId)) perfsByArtist.set(p.artistId, [])
      perfsByArtist.get(p.artistId)!.push(p)
    }

    const ratingRows = artistIds.length
      ? await prisma.organiserArtistRating.groupBy({
          by: ['artistId'],
          where: { artistId: { in: artistIds } },
          _avg: { rating: true },
          _count: { rating: true },
        })
      : []
    type RatingGroupRow = { artistId: string; _avg: { rating: number | null }; _count: { rating: number } }
    const ratingByArtist = new Map((ratingRows as RatingGroupRow[]).map((r) => [r.artistId, r]))

    // Checked-in bookings across every event any of these artists has
    // performed at, fetched once - then sliced per artist in memory
    // below rather than re-queried.
    const allEventIds = [...new Set((allPerfs as PerfRow[]).map((p) => p.eventId))]
    const allCheckedInBookings = allEventIds.length
      ? await prisma.booking.findMany({
          where: { eventId: { in: allEventIds }, status: 'CONFIRMED', checkedInAt: { not: null } },
          select: { userId: true, eventId: true },
        })
      : []
    const checkedInByEvent = new Map<string, { userId: string }[]>()
    for (const b of allCheckedInBookings) {
      if (!checkedInByEvent.has(b.eventId)) checkedInByEvent.set(b.eventId, [])
      checkedInByEvent.get(b.eventId)!.push({ userId: b.userId })
    }

    const roster = (artists as ArtistListItem[]).map((artist) => {
      const perfs = perfsByArtist.get(artist.id) || []
      const gigsPerformed = perfs.length

      const firstGigDate =
        perfs.length > 0
          ? perfs.reduce((earliest: Date, p: PerfRow) => (p.event.date < earliest ? p.event.date : earliest), perfs[0].event.date)
          : null

      // Hype Score - average of the artist's most recent N shows that
      // actually have a scored Hype Score (shows with no score yet, e.g.
      // too new or too few reviews, are skipped rather than counted as
      // zero - N configurable, session 56).
      const scoredShows = perfs
        .map((p) => computeHypeScore(p.event, p.reviews))
        .filter((score): score is number => score !== null)
      const recentScored = scoredShows.slice(0, settings.artistRosterHypeScoreLookback)
      const hypeScore =
        recentScored.length > 0
          ? Math.round((recentScored.reduce((sum: number, s: number) => sum + s, 0) / recentScored.length) * 10) / 10
          : null

      const featuredOrganiserIds = new Set(
        perfs.filter((p) => p.isFeaturedVouch).map((p) => p.event.organiserId)
      )

      const eventIds = [...new Set(perfs.map((p) => p.eventId))]
      const attendeeEventsByUser = new Map<string, Set<string>>()
      for (const eventId of eventIds) {
        for (const b of checkedInByEvent.get(eventId) || []) {
          if (!attendeeEventsByUser.has(b.userId)) attendeeEventsByUser.set(b.userId, new Set())
          attendeeEventsByUser.get(b.userId)!.add(eventId)
        }
      }
      const verifiedAttendees = attendeeEventsByUser.size
      const repeatAttendees = [...attendeeEventsByUser.values()].filter((evts) => evts.size >= 2).length

      const ratingAgg = ratingByArtist.get(artist.id)

      return {
        id: artist.id,
        name: artist.user.displayName || artist.user.name,
        avatar: artist.user.avatar,
        sceneStatus: sceneStatusById.get(artist.id) || 'NEW_EMERGING',
        gigsPerformed,
        firstGigDate,
        hypeScore,
        hypeScoreShowsUsed: recentScored.length,
        organiserAvgRating: ratingAgg?._avg.rating ?? null,
        organiserRatingCount: ratingAgg?._count.rating ?? 0,
        verifiedAttendees,
        repeatAttendees,
        featuredOrganiserCount: featuredOrganiserIds.size,
        featuredVouchThreshold: settings.sceneStatusFeaturedVouchThreshold,
        isSceneStatusHeadliner: artist.isSceneStatusHeadliner,
        headlinerNote: artist.headlinerNote,
      }
    })

    return NextResponse.json({
      roster,
      limits: {
        featuredVouchThreshold: settings.sceneStatusFeaturedVouchThreshold,
        hypeScoreLookback: settings.artistRosterHypeScoreLookback,
      },
    })
  } catch (err) {
    console.error('Error fetching admin artist roster:', err)
    return NextResponse.json({ error: 'Failed to fetch artist roster' }, { status: 500 })
  }
}
