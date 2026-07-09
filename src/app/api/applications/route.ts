import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user || user.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const artist = await prisma.artist.findUnique({ where: { userId: user.id } })
    if (!artist) {
      return NextResponse.json({ error: 'Artist profile not found' }, { status: 404 })
    }

    const body = await req.json()
    const { eventId, message } = body

    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event || event.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Event not found or not open for applications' }, { status: 404 })
    }

    const existing = await prisma.application.findFirst({
      where: { eventId, artistId: artist.id },
    })
    if (existing) {
      return NextResponse.json({ error: 'You already applied to this event' }, { status: 409 })
    }

    // §4.5 - respect the Organiser's max performer cap, if they set one.
    if (event.maxPerformers !== null) {
      const filledSlots = await prisma.performance.count({ where: { eventId } })
      if (filledSlots >= event.maxPerformers) {
        return NextResponse.json({ error: 'This event\'s lineup is already full' }, { status: 409 })
      }
    }

    // Auto-approval mode: verified artists skip manual review entirely and
    // get booked as a FREE/exposure slot immediately. The Organiser can
    // still adjust compensation for them afterward from the event page -
    // there's no per-applicant compensation input at apply time, so Auto
    // can only default to Free, never Paid/Buy-in.
    const shouldAutoApprove = event.applicationApprovalMode === 'AUTO' && user.isVerified

    const application = await prisma.application.create({
      data: {
        eventId,
        artistId: artist.id,
        message: message || '',
        status: shouldAutoApprove ? 'APPROVED' : 'PENDING',
      },
    })

    if (shouldAutoApprove) {
      const lineupCount = await prisma.performance.count({ where: { eventId } })
      await prisma.performance.create({
        data: { eventId, artistId: artist.id, slot: lineupCount + 1, duration: 10, compensationType: 'FREE' },
      })
    }

    return NextResponse.json(application, { status: 201 })
  } catch (err) {
    console.error('Error creating application:', err)
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
  }
}
