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
        events: {
          where: { status: { in: ['APPROVED', 'COMPLETED'] } },
          include: { venue: { select: { name: true, city: true } } },
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
    // explicit projection, not the raw Prisma object.
    return NextResponse.json({
      id: organiser.id,
      orgName: organiser.orgName,
      bio: organiser.bio,
      user: organiser.user,
      events: organiser.events,
      followerCount,
    })
  } catch (err) {
    console.error('Error fetching organiser:', err)
    return NextResponse.json({ error: 'Failed to fetch organiser' }, { status: 500 })
  }
}
