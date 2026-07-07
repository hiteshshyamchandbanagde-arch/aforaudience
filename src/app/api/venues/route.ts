import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const venues = await prisma.venue.findMany({ where: { isApproved: true } })
    return NextResponse.json(venues)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch venues' }, { status: 500 })
  }
}

export async function POST(req: Request) {
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
      return NextResponse.json({ error: 'Venue owner profile not found' }, { status: 404 })
    }

    const body = await req.json()
    const { name, address, city, capacity, acousticRating, facilities, seatMap, publish } = body

    if (!name || !address || !city) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // If seating sections are provided, total capacity is derived from them.
    const sections = Array.isArray(seatMap?.sections) ? seatMap.sections : []
    const seatMapCapacity = sections.reduce((sum: number, s: any) => sum + (Number(s.seats) || 0), 0)
    const finalCapacity = sections.length > 0 ? seatMapCapacity : parseInt(capacity)

    if (!finalCapacity || finalCapacity < 1) {
      return NextResponse.json(
        { error: 'Add at least one seating section, or provide a seating capacity' },
        { status: 400 }
      )
    }

    const venue = await prisma.venue.create({
      data: {
        name,
        address,
        city,
        capacity: finalCapacity,
        acousticRating: acousticRating ? parseFloat(acousticRating) : null,
        ownerId: venueOwner.id,
        photos: [],
        facilities: Array.isArray(facilities) ? facilities : [],
        seatMap: sections.length > 0 ? { sections } : undefined,
        // No admin-review pipeline exists yet, so venue owners publish their own
        // listings directly. Gate this behind real moderation once that exists.
        isApproved: Boolean(publish)
      }
    })

    return NextResponse.json(venue, { status: 201 })
  } catch (err) {
    console.error('Error creating venue:', err)
    return NextResponse.json({ error: 'Failed to create venue' }, { status: 500 })
  }
}
