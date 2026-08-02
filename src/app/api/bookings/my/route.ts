import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { formatSeatLabels } from '@/lib/seat-labels'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const bookings = await prisma.booking.findMany({
    where: { userId: user.id },
    include: {
      event: { include: { venue: true } },
      bookingSeats: { include: { seat: true } },
      // Session 65 (Hitesh feedback) - surfaces who's tagged on each
      // booking + their response status directly on My Tickets, not just
      // buried in the checkout flow. Same PENDING/ACCEPTED/DECLINED
      // status shape and "(pending)/(confirmed)/(declined)" labels
      // already used at checkout (src/app/checkout/[bookingId]/page.tsx)
      // for consistency.
      companionTags: {
        select: {
          id: true,
          status: true,
          taggedUser: { select: { id: true, name: true, displayName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Feedback cmrxnrzfr - real seat numbers (Numbered venues) were never
  // surfaced anywhere, only the section+quantity summary. bookingSeats is
  // an internal join detail, not meant for the client response shape -
  // strip it back off after deriving seatLabels from it.
  const shaped = bookings.map(({ bookingSeats, ...b }: { bookingSeats: { seat: { level: string; row: string; number: string } }[] } & Record<string, unknown>) => ({
    ...b,
    seatLabels: formatSeatLabels(bookingSeats.map((bs: { seat: { level: string; row: string; number: string } }) => bs.seat)),
  }))

  return NextResponse.json(shaped)
}
