import prisma from '@/lib/prisma'
import ArtistProfileClientPage from './ArtistProfileClientPage'
import { getSceneStatus } from '@/lib/scene-status'

export default async function ArtistProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const artist = await prisma.artist.findUnique({
    where: { id },
    include: {
      // Bug: this select omitted displayName, so ArtistProfileClientPage's
      // `displayName || name` fallback always resolved to the username
      // ("qa_artist_001") even when a real displayName existed in the DB
      // (confirmed: "Sai Jain" is set for this exact account and renders
      // correctly on the /artists listing card, which fetches it
      // correctly elsewhere - just not here).
      user: { select: { name: true, displayName: true, avatar: true } },
      performances: { include: { event: { include: { venue: true } } } },
      _count: { select: { performances: true } },
      // FEAT-2608-047 - self-managed tour highlight
      tourStops: { orderBy: { date: 'asc' } },
    },
  })

  // Tour by Organiser (12 Aug) - real, bookable Tour stops this artist
  // is fixed-lineup on, distinct from the self-reported tourStops above.
  // Only ever APPROVED/COMPLETED (same public-visibility rule as the
  // Tour landing page itself) and only where this artist's own
  // Performance is still active (not cancelled - e.g. after a decline).
  const realTourStops = artist
    ? await prisma.event.findMany({
        where: {
          category: 'TOUR_STOP',
          status: { in: ['APPROVED', 'COMPLETED'] },
          lineup: { some: { artistId: artist.id, cancelledAt: null } },
        },
        include: { venue: { select: { name: true, city: true } }, tour: { select: { title: true, slug: true } } },
        orderBy: { date: 'asc' },
      })
    : []

  // BUG-2608-025 (10 Aug) - these 3 queries were previously sequential
  // (followerCount, then checkedInBookings, then sceneStatus), each
  // paying its own round-trip on every prev/next hop. followerCount only
  // needs `id` (not the artist result), and checkedInBookings/sceneStatus
  // only need artist.id/performances, which are already resolved above -
  // none of the three depend on each other, so they run concurrently.
  const eventIds = artist ? [...new Set(artist.performances.map((p: { eventId: string }) => p.eventId))] : []
  const [followerCount, checkedInBookings, sceneStatus] = await Promise.all([
    artist ? prisma.follow.count({ where: { targetType: 'ARTIST', targetId: id } }) : Promise.resolve(0),
    eventIds.length
      ? prisma.booking.findMany({
          where: { eventId: { in: eventIds }, status: 'CONFIRMED', checkedInAt: { not: null } },
          select: { userId: true, eventId: true },
        })
      : Promise.resolve([]),
    artist ? getSceneStatus(artist.id) : Promise.resolve(null),
  ])

  // Follow is now polymorphic (Artist/Venue/Organiser share one table), so
  // there's no more direct Artist.followers relation to count via _count -
  // computed separately and folded into the same _count shape the client
  // component already expects.

  // Verified/Repeat Attendees (reputation epic §3) - live-computed per
  // Hitesh's decision (session 53). Distinct AUDIENCE ACCOUNTS with a
  // checked-in CONFIRMED booking at any event this artist performed at -
  // deliberately counted by distinct user, not by seat or by booking, so
  // a 4-seat group booking checked in once still reads as 1 verified
  // attendee, not 4. Repeat = same user checked in across 2+ DIFFERENT
  // events. Known limitation (documented in the design, not hidden):
  // check-in is per-booking not per-person, so someone who came only for
  // the headliner still counts as a verified attendee of the opener too,
  // and one person checking in a group booking undercounts real
  // attendance - naming it "Verified" rather than "Watched" is
  // deliberately honest about this until §7 Phase 2 (per-seat check-in)
  // closes the gap.
  const attendeeEventsByUser = new Map<string, Set<string>>()
  for (const b of checkedInBookings) {
    if (!attendeeEventsByUser.has(b.userId)) attendeeEventsByUser.set(b.userId, new Set())
    attendeeEventsByUser.get(b.userId)!.add(b.eventId)
  }
  const verifiedAttendees = attendeeEventsByUser.size
  const repeatAttendees = [...attendeeEventsByUser.values()].filter((events) => events.size >= 2).length

  // Scene Status (reputation epic §1, amended session 55) - live-computed,
  // same architectural choice as Verified/Repeat Attendees above. See
  // src/lib/scene-status.ts. Now fetched in the Promise.all above.

  const artistWithFollowers = artist
    ? { ...artist, _count: { ...artist._count, followers: followerCount }, verifiedAttendees, repeatAttendees }
    : null

  // Verified badge (blue tick) - automatic, from live feedback (18 Jul).
  // Same 4-field completion check as the dashboard's completion nudge,
  // plus a minimum track record (3+ performances, matching the existing
  // "3-review floor" already used for Wall of Fame elsewhere - reusing
  // an established threshold rather than inventing a new number).
  const isVerified = !!artist && (() => {
    const complete = [
      !!artist.bio?.trim(),
      artist.genre.length > 0,
      artist.styleTag.length > 0,
      !!artist.socialLinks && Object.values(artist.socialLinks as Record<string, string>).some((v) => !!v),
    ].every(Boolean)
    return complete && artist._count.performances >= 3
  })()

  return (
    <ArtistProfileClientPage
      artist={artistWithFollowers ? JSON.parse(JSON.stringify(artistWithFollowers)) : null}
      isVerified={isVerified}
      sceneStatus={sceneStatus}
      realTourStops={JSON.parse(JSON.stringify(realTourStops))}
    />
  )
}

// BUG-2608-025 follow-up (11 Aug, caught live - still 2-3s per hop after
// PR #420): force-dynamic was the real culprit, not the DB queries.
// Confirmed via Vercel runtime logs - every prev/next hop showed 2-3
// duplicate GETs to the same artist page within ~1s of each other. That's
// router.prefetch() (added in #420) firing a real request ahead of time,
// then the actual click firing ANOTHER fresh request - because
// force-dynamic opts this route out of the Router Cache entirely, so the
// prefetched response could never be reused. The person was still paying
// the full round-trip on click either way; the prefetch was pure waste.
//
// Unlike venues/page.tsx and events/[id]/page.tsx (which genuinely need
// force-dynamic for live seat availability), nothing on this page is
// that time-sensitive - bio, tour stops, performance history, and scene
// status don't need per-request freshness. A short revalidate window
// lets Next actually cache and reuse the prefetched neighbor pages, so
// clicking prev/next after landing (the normal case) is instant instead
// of re-fetching from scratch every time.
export const revalidate = 30
