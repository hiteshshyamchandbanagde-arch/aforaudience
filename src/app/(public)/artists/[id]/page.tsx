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
    />
  )
}

// Same reasoning as venues/page.tsx and events/[id]/page.tsx - no dynamic
// API is used here otherwise, so force per-request rendering.
export const dynamic = 'force-dynamic'
