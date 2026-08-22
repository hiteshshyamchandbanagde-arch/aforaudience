import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/organisers/[id] - public detail, powers the Organiser bio
// profile page (session 62, design.md §9.5).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const organiser = await prisma.organiser.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, avatar: true } },
        // Explicit select (not include) - the previous `include` pulled
        // every Event column (description, food, dresscode, etc.) into
        // the raw object this route then spread straight into the public
        // JSON response, undercutting the "explicit projection, not the
        // raw Prisma object" intent already stated below for the
        // Organiser fields themselves. Only the fields the profile page
        // rebuild actually renders.
        events: {
          where: { status: { in: ['APPROVED', 'COMPLETED'] } },
          select: {
            id: true,
            title: true,
            date: true,
            startTime: true,
            status: true,
            venue: { select: { name: true, city: true } },
          },
          orderBy: { date: 'asc' },
        },
        // Public profile only ever shows a bookable or wrapped tour - DRAFT
        // (still being built) and PENDING_CONSENT (artists haven't
        // accepted yet) are organiser-internal states, same reasoning as
        // the events filter above. CANCELLED is excluded too - nothing
        // for a visitor to act on.
        tours: {
          where: { status: { in: ['LIVE', 'COMPLETED'] } },
          select: {
            id: true,
            title: true,
            status: true,
            stops: {
              select: { id: true, date: true, venue: { select: { city: true } } },
              orderBy: { date: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!organiser || !organiser.isApproved) {
      return NextResponse.json({ error: 'Organiser not found' }, { status: 404 })
    }

    const followerCount = await prisma.follow.count({
      where: { targetType: 'ORGANISER', targetId: organiser.id },
    })

    // Never expose payout/tax-compliance internals on a public route -
    // explicit projection, not the raw Prisma object. followerCount is
    // computed and returned here for any future consumer, but the
    // profile page rebuild deliberately doesn't render it anywhere
    // (not a real, product-decided metric yet - see
    // docs/organisers-grid-embed-audit.md).
    return NextResponse.json({
      id: organiser.id,
      orgName: organiser.orgName,
      code: organiser.code,
      bio: organiser.bio,
      createdAt: organiser.createdAt,
      user: organiser.user,
      events: organiser.events,
      tours: organiser.tours,
      followerCount,
    })
  } catch (err) {
    console.error('Error fetching organiser:', err)
    return NextResponse.json({ error: 'Failed to fetch organiser' }, { status: 500 })
  }
}
