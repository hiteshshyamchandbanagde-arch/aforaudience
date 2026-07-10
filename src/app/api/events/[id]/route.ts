import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const event = await prisma.event.findUnique({ where: { id }, include: { venue: true } })

    if (!event || event.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json(event)
  } catch (err) {
    console.error('Error fetching event:', err)
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const event = await prisma.event.findUnique({ where: { id } })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN') {
      const organiser = await prisma.organiser.findUnique({ where: { id: event.organiserId } })
      if (!organiser || organiser.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (!organiser.isApproved) {
        return NextResponse.json({ error: 'Your Organiser account is still pending approval' }, { status: 403 })
      }
    }

    const body = await req.json()
    const {
      title, description, type, date, startTime, endTime,
      isFree, ticketPrice, totalSeats, dresscode, vibe, surpriseAct, publish,
    } = body

    // §4.5 suggestion #1: same rule as event creation - an event with a
    // venue can't go fully live until that venue's booking is actually
    // confirmed. Unlike creation, this event may already have a CONFIRMED
    // booking by the time it's edited (the Organiser saved as draft first,
    // the Venue Owner confirmed in the meantime, now they're publishing) -
    // so this checks the real current booking state rather than assuming.
    let resolvedStatus: string | undefined
    if (publish !== undefined) {
      if (!publish) {
        resolvedStatus = 'DRAFT'
      } else if (!event.venueId) {
        resolvedStatus = 'APPROVED'
      } else {
        const confirmedBooking = await prisma.venueBooking.findFirst({
          where: { eventId: event.id, venueId: event.venueId, status: 'CONFIRMED' },
        })
        resolvedStatus = confirmedBooking ? 'APPROVED' : 'PENDING_APPROVAL'
      }
    }

    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(type && { type }),
        ...(date && { date: new Date(date) }),
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        ...(isFree !== undefined && { isFree: Boolean(isFree) }),
        ...(ticketPrice !== undefined && {
          ticketPrice: isFree ? null : ticketPrice ? parseFloat(ticketPrice) : null,
        }),
        ...(totalSeats && { totalSeats: parseInt(totalSeats) }),
        ...(dresscode !== undefined && { dresscode }),
        ...(vibe !== undefined && { vibe }),
        ...(surpriseAct !== undefined && { surpriseAct: Boolean(surpriseAct) }),
        ...(resolvedStatus && { status: resolvedStatus }),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Error updating event:', err)
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
  }
}
