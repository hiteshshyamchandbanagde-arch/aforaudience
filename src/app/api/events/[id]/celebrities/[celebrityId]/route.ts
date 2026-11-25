import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// DELETE /api/events/[id]/celebrities/[celebrityId]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; celebrityId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const currentUser = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { id: eventId, celebrityId } = await params
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { organiserId: true } })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (currentUser.role !== 'ADMIN') {
      const organiser = await prisma.organiser.findUnique({ where: { id: event.organiserId } })
      if (!organiser || organiser.userId !== currentUser.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const celebrity = await prisma.celebrity.findUnique({ where: { id: celebrityId } })
    if (!celebrity || celebrity.eventId !== eventId) {
      return NextResponse.json({ error: 'Celebrity entry not found' }, { status: 404 })
    }

    await prisma.celebrity.delete({ where: { id: celebrityId } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error removing celebrity:', err)
    return NextResponse.json({ error: 'Failed to remove celebrity entry' }, { status: 500 })
  }
}
