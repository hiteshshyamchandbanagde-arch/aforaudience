import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id }
    })

    if (!user || user.role !== 'VENUE_OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const venueOwner = await prisma.venueOwner.findUnique({
      where: { userId: user.id }
    })

    if (!venueOwner) {
      return NextResponse.json([])
    }

    const venues = await prisma.venue.findMany({
      where: { ownerId: venueOwner.id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(venues)
  } catch (err) {
    console.error('Error fetching venues:', err)
    return NextResponse.json({ error: 'Failed to fetch venues' }, { status: 500 })
  }
}
