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

    const application = await prisma.application.create({
      data: {
        eventId,
        artistId: artist.id,
        message: message || '',
        status: 'PENDING',
      },
    })

    return NextResponse.json(application, { status: 201 })
  } catch (err) {
    console.error('Error creating application:', err)
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
  }
}
