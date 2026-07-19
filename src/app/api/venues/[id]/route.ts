import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const venue = await prisma.venue.findUnique({
      where: { id },
      include: { owner: { include: { user: { select: { isSuspended: true } } } } },
    })
    // H3 - same suspension gate as the public listing (GET /api/venues).
    if (!venue || venue.owner.user.isSuspended) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(venue)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch venue' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
      where: { id }
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
      if (!venueOwner.isApproved) {
        return NextResponse.json({ error: 'Your Venue Owner account is still pending approval' }, { status: 403 })
      }
    }

    const body = await req.json()
    const { name, address, city, capacity, acousticRating, facilities, seatMap, publish, mapsUrl } = body

    const sections = Array.isArray(seatMap?.sections) ? seatMap.sections : undefined
    const seatMapCapacity = sections
      ? sections.reduce((sum: number, s: any) => sum + (Number(s.seats) || 0), 0)
      : undefined

    const updatedVenue = await prisma.venue.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(address && { address }),
        ...(city && { city }),
        ...(seatMapCapacity !== undefined ? { capacity: seatMapCapacity } : capacity ? { capacity } : {}),
        ...(acousticRating !== undefined && { acousticRating }),
        ...(mapsUrl !== undefined && { mapsUrl: mapsUrl && mapsUrl.trim() ? mapsUrl.trim() : null }),
        ...(facilities !== undefined && { facilities: Array.isArray(facilities) ? facilities : [] }),
        ...(sections !== undefined && { seatMap: { sections } }),
        ...(publish !== undefined && { isApproved: Boolean(publish) })
      }
    })

    return NextResponse.json(updatedVenue)
  } catch (err) {
    console.error('Error updating venue:', err)
    return NextResponse.json({ error: 'Failed to update venue' }, { status: 500 })
  }
}
