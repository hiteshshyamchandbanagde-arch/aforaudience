import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user || user.role !== 'ORGANISER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!user.isVerified) {
      return NextResponse.json(
        { error: 'Verify your phone number before booking a venue.', reason: 'PHONE_NOT_VERIFIED' },
        { status: 403 }
      )
    }

    const organiser = await prisma.organiser.findUnique({ where: { userId: user.id } })
    if (!organiser) {
      return NextResponse.json({ error: 'Organiser profile not found' }, { status: 404 })
    }
    if (!organiser.isApproved) {
      return NextResponse.json({ error: 'Your Organiser account is still pending approval' }, { status: 403 })
    }

    const body = await req.json()
    const { venueId, eventId, fromDate, toDate, amount } = body

    if (!venueId || !eventId || !fromDate || !toDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event || event.organiserId !== organiser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const venue = await prisma.venue.findUnique({ where: { id: venueId } })
    if (!venue || !venue.isApproved) {
      return NextResponse.json({ error: 'Venue not available' }, { status: 400 })
    }

    // Replace any existing booking request for this event (an organiser
    // rebooking a different venue shouldn't leave stale requests behind).
    await prisma.venueBooking.deleteMany({ where: { eventId } })

    const booking = await prisma.venueBooking.create({
      data: {
        venueId,
        organiserId: organiser.id,
        eventId,
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        status: 'PENDING',
        amount: amount ? parseFloat(amount) : 0,
      },
    })

    await prisma.event.update({ where: { id: eventId }, data: { venueId } })

    return NextResponse.json(booking, { status: 201 })
  } catch (err) {
    console.error('Error creating venue booking:', err)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }
}
