import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Attendee list for the check-in screen - "who's checked in / who's still
// pending" for an Organiser or Admin. Only CONFIRMED bookings count as real
// attendees (PENDING/CANCELLED/REFUNDED never show up at the door).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN') {
      const organiser = await prisma.organiser.findUnique({ where: { id: event.organiserId } })
      if (!organiser || organiser.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const bookings = await prisma.booking.findMany({
      where: { eventId, status: 'CONFIRMED' },
      include: { user: { select: { name: true, displayName: true } } },
      orderBy: [{ checkedInAt: 'asc' }, { createdAt: 'asc' }],
    })

    const attendees = bookings.map((b) => ({
      bookingId: b.id,
      name: b.user.displayName || b.user.name,
      seats: b.seats,
      checkedInAt: b.checkedInAt,
    }))

    return NextResponse.json({
      total: attendees.length,
      checkedIn: attendees.filter((a) => a.checkedInAt).length,
      attendees,
    })
  } catch (err) {
    console.error('Error fetching attendees:', err)
    return NextResponse.json({ error: 'Failed to fetch attendees' }, { status: 500 })
  }
}
