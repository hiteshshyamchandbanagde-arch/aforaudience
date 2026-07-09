import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Reserves seats for an event. This is deliberately NOT a confirmed
// booking - there's no payment integration yet (blocked on Razorpay being
// set up), so this creates a PENDING reservation and is honest about that
// in the response. It exists so the actual seat-selection UI, capacity
// enforcement, and the auth-gated "resume exactly where you were" flow
// (B2) all work for real - the only missing piece is the payment step
// itself, which slots in later without needing to rebuild any of this.
//
// Known gap, not solved here: PENDING bookings never expire, so an
// abandoned selection permanently eats capacity. Fine for early/low-
// traffic testing, not fine at real scale - needs a TTL/cleanup pass
// before this handles real audience volume.
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventId, seats } = await req.json()
    if (!eventId || !seats || typeof seats !== 'object') {
      return NextResponse.json({ error: 'Missing eventId or seats' }, { status: 400 })
    }

    const requestedEntries = Object.entries(seats).filter(([, qty]) => Number(qty) > 0) as [string, number][]
    if (requestedEntries.length === 0) {
      return NextResponse.json({ error: 'Select at least one seat' }, { status: 400 })
    }

    const totalRequested = requestedEntries.reduce((sum, [, qty]) => sum + Number(qty), 0)

    const result = await prisma.$transaction(async (tx: any) => {
      const event = await tx.event.findUnique({ where: { id: eventId }, include: { ticketTiers: true } })
      if (!event || event.status !== 'APPROVED') {
        throw new Error('Event not found or not open for booking')
      }

      if (totalRequested > event.maxSeatsPerBooking) {
        throw new Error(`Max ${event.maxSeatsPerBooking} seats per booking for this event`)
      }

      // Already-reserved counts, computed from existing bookings rather than
      // a separately-maintained counter - avoids a field that can drift out
      // of sync with what's actually been booked.
      const existingBookings = await tx.booking.findMany({
        where: { eventId, status: { in: ['PENDING', 'CONFIRMED'] } },
        select: { seats: true },
      })
      const bookedSoFar: Record<string, number> = {}
      for (const b of existingBookings) {
        const s = b.seats as Record<string, number>
        for (const [section, qty] of Object.entries(s || {})) {
          bookedSoFar[section] = (bookedSoFar[section] || 0) + Number(qty)
        }
      }

      let totalAmount = 0

      if (event.ticketTiers.length > 0) {
        for (const [sectionName, qty] of requestedEntries) {
          const tier = event.ticketTiers.find((t: any) => t.sectionName === sectionName)
          if (!tier) throw new Error(`Unknown section: ${sectionName}`)
          const already = bookedSoFar[sectionName] || 0
          if (already + Number(qty) > tier.totalSeats) {
            throw new Error(`Not enough seats left in ${sectionName}`)
          }
          totalAmount += tier.price * Number(qty)
        }
      } else {
        // Flat-price event, single implicit "General" section.
        const already = bookedSoFar['General'] || 0
        if (already + totalRequested > event.totalSeats) {
          throw new Error('Not enough seats left')
        }
        totalAmount = event.isFree ? 0 : (event.ticketPrice || 0) * totalRequested
      }

      return tx.booking.create({
        data: {
          userId: user.id,
          eventId,
          seats,
          totalAmount,
          status: 'PENDING',
        },
      })
    })

    return NextResponse.json({
      booking: result,
      message: 'Seats reserved. Online payment isn\'t live yet - we\'ll email you when checkout is ready to complete your booking.',
    }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reserve seats'
    console.error('Error creating booking:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
