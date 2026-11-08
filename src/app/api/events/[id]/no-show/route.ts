import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { canMarkNoShow } from '@/lib/pay-at-entry'

// D1 (Hitesh, 8 Nov) - organiser "Mark no-show" for one booking. Allowed
// from the event's start until 48 h after it ends, by the event's
// organiser or an Admin, on a CONFIRMED booking that was not checked in.
// Body: { bookingId }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({ where: { id: (session.user as { id: string }).id } })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    const body = await req.json().catch(() => ({}))
    const bookingId = typeof body?.bookingId === 'string' ? body.bookingId : ''
    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })
    }

    if (!canMarkNoShow(event)) {
      return NextResponse.json(
        { error: 'No-shows can be marked from the event start until 48 hours after it ends.' },
        { status: 400 }
      )
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    if (!booking || booking.eventId !== eventId || booking.status !== 'CONFIRMED') {
      return NextResponse.json({ error: 'Booking not found for this event' }, { status: 404 })
    }
    if (booking.checkedInAt || booking.attendance === 'ATTENDED') {
      return NextResponse.json({ error: 'This guest is already checked in.' }, { status: 409 })
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { attendance: 'NO_SHOW' },
      select: { id: true, attendance: true },
    })
    return NextResponse.json({ bookingId: updated.id, attendance: updated.attendance })
  } catch (err) {
    console.error('Error marking no-show:', err)
    return NextResponse.json({ error: 'Failed to mark no-show' }, { status: 500 })
  }
}
