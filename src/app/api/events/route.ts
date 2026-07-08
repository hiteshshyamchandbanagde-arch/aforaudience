import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      where: { status: 'APPROVED' },
      include: { venue: true, lineup: true },
      orderBy: { date: 'asc' },
    })
    return NextResponse.json(events)
  } catch (err) {
    console.error('Error fetching events:', err)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}

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

    const organiser = await prisma.organiser.findUnique({ where: { userId: user.id } })
    if (!organiser) {
      return NextResponse.json({ error: 'Organiser profile not found' }, { status: 404 })
    }

    const body = await req.json()
    const {
      title, description, type, date, startTime, endTime,
      isFree, ticketPrice, totalSeats, dresscode, vibe, surpriseAct,
      venueId, bookingAmount, publish,
    } = body

    if (!title || !description || !type || !date || !startTime || !endTime || !totalSeats) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const seats = parseInt(totalSeats)
    if (!seats || seats < 1) {
      return NextResponse.json({ error: 'Total seats must be at least 1' }, { status: 400 })
    }

    const event = await prisma.event.create({
      data: {
        organiserId: organiser.id,
        venueId: venueId || null,
        title,
        description,
        type,
        date: new Date(date),
        startTime,
        endTime,
        isFree: Boolean(isFree),
        ticketPrice: isFree ? null : ticketPrice ? parseFloat(ticketPrice) : null,
        totalSeats: seats,
        availableSeats: seats,
        dresscode: dresscode || null,
        vibe: vibe || null,
        surpriseAct: Boolean(surpriseAct),
        // No admin-review pipeline exists yet, so organisers publish their own
        // listings directly, same bridge used for venues. Gate this behind
        // real moderation once that exists.
        status: publish ? 'APPROVED' : 'DRAFT',
      },
    })

    // Booking a venue for this event: create a request record (venue owner
    // approval isn't built yet, so this starts PENDING and just links the
    // venue to the event immediately).
    if (venueId) {
      await prisma.venueBooking.create({
        data: {
          venueId,
          organiserId: organiser.id,
          eventId: event.id,
          fromDate: new Date(date),
          toDate: new Date(date),
          status: 'PENDING',
          amount: bookingAmount ? parseFloat(bookingAmount) : 0,
        },
      })
    }

    return NextResponse.json(event, { status: 201 })
  } catch (err) {
    console.error('Error creating event:', err)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}
