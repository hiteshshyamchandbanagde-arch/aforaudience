import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { formatSeatLabels } from '@/lib/seat-labels'

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
      include: {
        user: { select: { name: true, displayName: true } },
        // Companion Tagging Phase 2 (step 6) - only ACCEPTED tags surface
        // at the door. PENDING/DECLINED were never confirmed by the
        // tagged person, so there's nothing to check in.
        companionTags: {
          where: { status: 'ACCEPTED' },
          include: { taggedUser: { select: { name: true, displayName: true } } },
          // Deterministic order, not creation order - needed below to
          // zip against seat labels the same way on every request.
          orderBy: { taggedUserId: 'asc' },
        },
        bookingSeats: { include: { seat: true } },
      },
      orderBy: [{ checkedInAt: 'asc' }, { createdAt: 'asc' }],
    })

    const attendees = bookings.map((b) => {
      // Display-only "who's roughly sitting where" for NUMBERED bookings
      // (Hitesh, session 54 - people move seats after the interval anyway,
      // this doesn't need to be exact, just needs a label at the door).
      // Deterministic zip (booker first, then companions sorted by id,
      // against seat labels sorted the same way every request) rather
      // than actually-random, so the label doesn't shuffle on every
      // refresh of this screen - nothing is persisted or tracked as real
      // seat assignment.
      const seatLabels = b.bookingSeats.length > 0
        ? formatSeatLabels(b.bookingSeats.map((bs) => bs.seat))
        : []
      const [bookerSeatLabel, ...companionSeatLabels] = seatLabels

      return {
        bookingId: b.id,
        name: b.user.displayName || b.user.name,
        seats: b.seats,
        seatLabel: bookerSeatLabel ?? null,
        checkedInAt: b.checkedInAt,
        companions: b.companionTags.map((t, i) => ({
          id: t.id,
          name: t.taggedUser.displayName || t.taggedUser.name,
          seatLabel: companionSeatLabels[i] ?? null,
          checkedInAt: t.checkedInAt,
        })),
      }
    })

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
