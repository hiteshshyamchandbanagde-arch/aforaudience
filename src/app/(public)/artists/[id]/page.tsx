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

  return <ArtistProfileClientPage artist={artist ? JSON.parse(JSON.stringify(artist)) : null} />
}

// Same reasoning as venues/page.tsx and events/[id]/page.tsx - no dynamic
// API is used here otherwise, so force per-request rendering.
export const dynamic = 'force-dynamic'
