import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { parseAmount } from '@/lib/money-validation'
import { launchWaveBlock } from '@/lib/platform-settings'
import { venueBookingNeedsW4 } from '@/lib/launch-waves'

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

    // S1b-a - W4 (direct B2B bookings) gate: a venue booking with an amount
    // above 0 is refused while W4 is closed. Zero-amount bookings are W2.
    const w4 = venueBookingNeedsW4(amount) ? await launchWaveBlock('W4', user.role) : null
    if (w4) return NextResponse.json(w4.body, { status: w4.status })

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

    // Validation-gap cluster fix (design.md §9.2, 26 Jul) - this route had
    // no amount validation at all (not even a >0 check), the same family
    // of gap as the counter-offer route that produced the 3.33e90
    // corrupted record.
    const amountCheck = parseAmount(amount, { label: 'Offer Amount', allowZero: true })
    if (!amountCheck.ok) {
      return NextResponse.json({ error: amountCheck.error }, { status: 400 })
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
        amount: amountCheck.value ?? 0,
      },
    })

    await prisma.event.update({ where: { id: eventId }, data: { venueId } })

    return NextResponse.json(booking, { status: 201 })
  } catch (err) {
    console.error('Error creating venue booking:', err)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }
}
