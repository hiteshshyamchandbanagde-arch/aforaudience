import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const venue = await prisma.venue.findUnique({ where: { id: params.id } })
    if (!venue) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(venue)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch venue' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
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
      where: { id: params.id }
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

    const body = await req.json()
    const { name, address, city, capacity, acousticRating } = body

    const updatedVenue = await prisma.venue.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(address && { address }),
        ...(city && { city }),
        ...(capacity && { capacity }),
        ...(acousticRating !== undefined && { acousticRating })
      }
    })

    return NextResponse.json(updatedVenue)
  } catch (err) {
    console.error('Error updating venue:', err)
    return NextResponse.json({ error: 'Failed to update venue' }, { status: 500 })
  }
}
