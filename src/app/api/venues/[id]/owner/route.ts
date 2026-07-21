import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const venue = await prisma.venue.findUnique({
      where: { id },
      include: {
        // NUMBERED venues have no seatMap.sections (GA-only field) - their
        // zones live in real Seat/VenueZonePrice rows instead. Without
        // these, this page had no way to show a Numbered venue's actual
        // zones and always fell back to "No seating sections defined yet"
        // even after a real seat map was saved (see design.md §9).
        seats: { select: { tierLabel: true } },
        zonePrices: { select: { level: true, zoneName: true, suggestedPrice: true } },
      },
    })

    if (!venue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }

    // Check if user is the owner or an admin
    if (user.role !== 'ADMIN') {
      const venueOwner = await prisma.venueOwner.findUnique({
        where: { id: venue.ownerId }
      })

      if (!venueOwner || venueOwner.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json(venue)
  } catch (err) {
    console.error('Error fetching venue:', err)
    return NextResponse.json({ error: 'Failed to fetch venue' }, { status: 500 })
  }
}
