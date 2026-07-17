import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Check-in/scan flow (EPIC N). The QR on the ticket PDF (and the "BOOKING ID"
// text printed alongside it, for manual entry) encodes booking.id as-is -
// see src/lib/ticket-pdf.ts. This endpoint is the actual anti-forgery gate:
// the QR value itself isn't signed, but it can only be redeemed once, only
// against the event it belongs to, and only by that event's Organiser/Admin.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await req.json()
    const code = typeof body?.code === 'string' ? body.code.trim() : ''

    if (!code) {
      return NextResponse.json({ ok: false, reason: 'EMPTY', message: 'Scan a ticket or enter a booking code.' }, { status: 400 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id: code },
      include: { user: true },
    })

    if (!booking) {
      return NextResponse.json({ ok: false, reason: 'NOT_FOUND', message: 'No booking matches this code.' }, { status: 404 })
    }

    if (booking.eventId !== eventId) {
      return NextResponse.json({ ok: false, reason: 'WRONG_EVENT', message: 'This ticket is for a different event.' }, { status: 409 })
    }

    if (booking.status !== 'CONFIRMED') {
      return NextResponse.json({
        ok: false,
        reason: 'NOT_CONFIRMED',
        message: `Booking status is ${booking.status}, not confirmed - can't check in.`,
      }, { status: 409 })
    }

    if (booking.checkedInAt) {
      return NextResponse.json({
        ok: false,
        reason: 'ALREADY_CHECKED_IN',
        message: 'Already checked in.',
        attendeeName: booking.user.displayName || booking.user.name,
        seats: booking.seats,
        checkedInAt: booking.checkedInAt,
      }, { status: 409 })
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { checkedInAt: new Date(), checkedInByUserId: user.id },
    })

    return NextResponse.json({
      ok: true,
      attendeeName: booking.user.displayName || booking.user.name,
      seats: booking.seats,
      checkedInAt: updated.checkedInAt,
    })
  } catch (err) {
    console.error('Error checking in booking:', err)
    return NextResponse.json({ ok: false, reason: 'ERROR', message: 'Check-in failed.' }, { status: 500 })
  }
}

// Summary counts for the scanner UI's "X of Y checked in" header.
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

    const [total, checkedIn] = await Promise.all([
      prisma.booking.count({ where: { eventId, status: 'CONFIRMED' } }),
      prisma.booking.count({ where: { eventId, status: 'CONFIRMED', checkedInAt: { not: null } } }),
    ])

    return NextResponse.json({ total, checkedIn })
  } catch (err) {
    console.error('Error fetching check-in summary:', err)
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 })
  }
}
