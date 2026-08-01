import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/venue-owners/[id] - public detail, powers the Venue Owner bio
// profile page (session 62, design.md §9.5).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const venueOwner = await prisma.venueOwner.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, avatar: true } },
        venues: {
          where: { isApproved: true },
          select: { id: true, name: true, city: true, capacity: true, photos: true, seatingMode: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!venueOwner || !venueOwner.isApproved) {
      return NextResponse.json({ error: 'Venue Owner not found' }, { status: 404 })
    }

    // Follow today only targets an individual Venue, not a VenueOwner
    // directly (see src/lib/follow.ts) - so no owner-level follower count
    // here, unlike the Organiser detail route. Each venue card links out
    // to its own page where the existing VenueFollowButton applies.
    return NextResponse.json({
      id: venueOwner.id,
      bio: venueOwner.bio,
      user: venueOwner.user,
      venues: venueOwner.venues,
    })
  } catch (err) {
    console.error('Error fetching venue owner:', err)
    return NextResponse.json({ error: 'Failed to fetch venue owner' }, { status: 500 })
  }
}
