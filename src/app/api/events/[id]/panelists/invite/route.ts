import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// POST /api/events/[id]/panelists/invite
// body: { userId: string, bio?: string }
//
// Accept-to-Appear (reputation epic §8, session 57). Organiser looks the
// person up first via GET /api/users/search (same lookup pattern §7's
// companion tagging already uses), then invites by that real userId - no
// free-text name path exists anymore. Status starts PENDING; only visible
// to the organiser in their own dashboard (owner route) until the invited
// person accepts from their own account. `name`/`photoUrl` on the row are
// left null at invite time - public display always reads the linked
// user's own displayName/avatar once ACCEPTED, never organiser-typed text.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const currentUser = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { id: eventId } = await params
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, organiserId: true, isCompetitionShow: true } })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (currentUser.role !== 'ADMIN') {
      const organiser = await prisma.organiser.findUnique({ where: { id: event.organiserId } })
      if (!organiser || organiser.userId !== currentUser.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    if (!event.isCompetitionShow) {
      return NextResponse.json({ error: 'This event is not marked as a competition show' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    if (typeof body.userId !== 'string' || !body.userId) {
      return NextResponse.json({ error: 'userId is required — look the person up first via /api/users/search' }, { status: 400 })
    }

    const invitee = await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true, isSuspended: true, displayName: true, name: true } })
    if (!invitee || invitee.isSuspended) {
      return NextResponse.json({ error: 'That account could not be found' }, { status: 404 })
    }

    const existing = await prisma.eventPanelist.findFirst({
      where: { eventId, userId: body.userId, status: { in: ['PENDING', 'ACCEPTED'] } },
    })
    if (existing) {
      return NextResponse.json({ error: `${invitee.displayName || invitee.name} has already been invited to this event's panel` }, { status: 409 })
    }

    const maxOrder = await prisma.eventPanelist.aggregate({ where: { eventId }, _max: { order: true } })

    const panelist = await prisma.eventPanelist.create({
      data: {
        eventId,
        userId: body.userId,
        name: invitee.displayName || invitee.name, // organiser-facing draft label only, pre-acceptance
        bio: typeof body.bio === 'string' && body.bio.trim() ? body.bio.trim().slice(0, 500) : null,
        order: (maxOrder._max.order ?? -1) + 1,
        status: 'PENDING',
      },
    })

    return NextResponse.json({ panelist })
  } catch (err) {
    console.error('Error inviting panelist:', err)
    return NextResponse.json({ error: 'Failed to invite panelist' }, { status: 500 })
  }
}
