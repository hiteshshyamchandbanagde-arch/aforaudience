import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// DELETE /api/events/[id]/panelists/[panelistId]
//
// Organiser removes a panelist entry - a still-PENDING invite they want
// to retract, a DECLINED one they're clearing out, or even an ACCEPTED
// one they're swapping out. No confirmation-of-intent needed server-side
// beyond ownership; the client gates this with its own confirm dialog.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; panelistId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const currentUser = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { id: eventId, panelistId } = await params
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

    const panelist = await prisma.eventPanelist.findUnique({ where: { id: panelistId } })
    if (!panelist || panelist.eventId !== eventId) {
      return NextResponse.json({ error: 'Panelist not found' }, { status: 404 })
    }

    await prisma.eventPanelist.delete({ where: { id: panelistId } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error removing panelist:', err)
    return NextResponse.json({ error: 'Failed to remove panelist' }, { status: 500 })
  }
}
