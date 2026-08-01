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

    const roster = await Promise.all(
      (artists as ArtistListItem[]).map(async (artist) => {
        const performances = await prisma.performance.findMany({
          where: { artistId: artist.id, cancelledAt: null },
          select: {
            eventId: true,
            event: { select: { date: true, startTime: true, endTime: true, organiserId: true } },
            reviews: { select: { rating: true } },
            isFeaturedVouch: true,
          },
          orderBy: { event: { date: 'desc' } },
        })

        type PerfRow = {
          eventId: string
          event: { date: Date; startTime: string; endTime: string; organiserId: string }
          reviews: { rating: number | null }[]
          isFeaturedVouch: boolean
        }
        const perfs = performances as PerfRow[]

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

        const orgRatingAgg = await prisma.organiserArtistRating.aggregate({
          where: { artistId: artist.id },
          _avg: { rating: true },
          _count: { rating: true },
        })

        const eventIds = [...new Set(perfs.map((p) => p.eventId))]
        const checkedInBookings = eventIds.length
          ? await prisma.booking.findMany({
              where: { eventId: { in: eventIds }, status: 'CONFIRMED', checkedInAt: { not: null } },
              select: { userId: true, eventId: true },
            })
          : []
        const attendeeEventsByUser = new Map<string, Set<string>>()
        for (const b of checkedInBookings) {
          if (!attendeeEventsByUser.has(b.userId)) attendeeEventsByUser.set(b.userId, new Set())
          attendeeEventsByUser.get(b.userId)!.add(b.eventId)
        }
        const verifiedAttendees = attendeeEventsByUser.size
        const repeatAttendees = [...attendeeEventsByUser.values()].filter((evts) => evts.size >= 2).length

        return {
          id: artist.id,
          name: artist.user.displayName || artist.user.name,
          avatar: artist.user.avatar,
          sceneStatus: sceneStatusById.get(artist.id) || 'NEW_EMERGING',
          gigsPerformed,
          firstGigDate,
          hypeScore,
          hypeScoreShowsUsed: recentScored.length,
          organiserAvgRating: orgRatingAgg._avg.rating,
          organiserRatingCount: orgRatingAgg._count.rating,
          verifiedAttendees,
          repeatAttendees,
          featuredOrganiserCount: featuredOrganiserIds.size,
          featuredVouchThreshold: settings.sceneStatusFeaturedVouchThreshold,
          isSceneStatusHeadliner: artist.isSceneStatusHeadliner,
          headlinerNote: artist.headlinerNote,
        }
      })
    )

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
