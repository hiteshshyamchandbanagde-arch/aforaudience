import prisma from '@/lib/prisma'
import ArtistProfileClientPage from './ArtistProfileClientPage'

export default async function ArtistProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const artist = await prisma.artist.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, avatar: true } },
      performances: { include: { event: { include: { venue: true } } } },
      _count: { select: { performances: true } },
    },
  })

  // Follow is now polymorphic (Artist/Venue/Organiser share one table), so
  // there's no more direct Artist.followers relation to count via _count -
  // computed separately and folded into the same _count shape the client
  // component already expects.
  const followerCount = artist
    ? await prisma.follow.count({ where: { targetType: 'ARTIST', targetId: id } })
    : 0

  const artistWithFollowers = artist
    ? { ...artist, _count: { ...artist._count, followers: followerCount } }
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
    />
  )
}

// Same reasoning as venues/page.tsx and events/[id]/page.tsx - no dynamic
// API is used here otherwise, so force per-request rendering.
export const dynamic = 'force-dynamic'
