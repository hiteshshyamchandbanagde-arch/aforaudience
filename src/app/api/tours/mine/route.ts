import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/tours/mine - the current Organiser's own Tours, including
// draft/pending-consent ones (unlike GET /api/tours/[slug], which is
// public and only ever shows bookable stops). Used by the Tour
// management dashboard so the organiser can see exactly which artists
// still haven't responded and which stops are/aren't live.
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user || user.role !== 'ORGANISER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const organiser = await prisma.organiser.findUnique({ where: { userId: user.id } })
    if (!organiser) {
      return NextResponse.json({ error: 'Organiser profile not found' }, { status: 404 })
    }

    const tours = await prisma.tour.findMany({
      where: { organiserId: organiser.id },
      include: {
        consents: {
          include: { artist: { include: { user: { select: { name: true, displayName: true } } } } },
        },
        stops: {
          include: {
            venue: { select: { name: true, city: true } },
            lineup: {
              where: { cancelledAt: null },
              include: { artist: { include: { user: { select: { name: true, displayName: true } } } } },
            },
          },
          orderBy: { date: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ tours })
  } catch (err) {
    console.error('[tours/mine GET] error:', err)
    return NextResponse.json({ error: 'Failed to load your Tours' }, { status: 500 })
  }
}
