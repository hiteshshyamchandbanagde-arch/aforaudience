import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { generateTicketPdf, type TicketData } from '@/lib/ticket-pdf'

// GET /api/bookings/[id]/ticket
//
// Streams the ticket PDF for a booking. Auth-gated (owner or admin) and
// only issues a PDF for CONFIRMED bookings — a PENDING reservation is
// not a ticket. Regenerates the PDF from live booking data on every
// request; we deliberately don't cache/store PDFs.
//
// Why regenerate rather than store:
//   1. Booking data is small; PDF generation takes ~150-300ms — fast
//      enough to feel instant.
//   2. Avoids the "where does the file live" question (S3? Supabase
//      Storage? R2?) which is out of scope for this checkpoint.
//   3. Sidesteps stale-cache bugs: if we ever update the ticket layout,
//      old bookings' next download gets the new layout automatically.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
    })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        user: true,
        event: { include: { venue: true } },
      },
    })
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (booking.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (booking.status !== 'CONFIRMED') {
      return NextResponse.json(
        { error: 'Ticket only available for confirmed bookings' },
        { status: 400 }
      )
    }

    const data: TicketData = {
      bookingId: booking.id,
      eventTitle: booking.event.title,
      eventDate: booking.event.date,
      eventStartTime: booking.event.startTime,
      eventEndTime: booking.event.endTime,
      venueName: booking.event.venue?.name ?? null,
      venueCity: booking.event.venue?.city ?? null,
      seats: (booking.seats as Record<string, number>) ?? {},
      totalAmount: booking.totalAmount,
      attendeeName:
        booking.user?.displayName ?? booking.user?.name ?? 'Guest',
      purchasedAt: booking.createdAt,
    }

    const pdfBytes = await generateTicketPdf(data)

    return new NextResponse(pdfBytes as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="aforaudience-ticket-${booking.id}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('[ticket.GET] error:', err)
    return NextResponse.json(
      { error: 'Failed to generate ticket' },
      { status: 500 }
    )
  }
}
