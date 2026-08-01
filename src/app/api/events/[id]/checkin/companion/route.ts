import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// POST /api/events/[id]/checkin/companion
// body: { companionTagId }
//
// Companion Tagging Phase 2 (reputation epic §7, step 6) - checks in one
// ACCEPTED companion individually, separate from the booking-level scan
// in /api/events/[id]/checkin (EPIC N, unchanged). Same
// Organiser-of-event-or-Admin auth guard as that route.
//
// Only ACCEPTED tags can be checked in - a PENDING or DECLINED tag was
// never confirmed by the tagged person, so there's nothing legitimate to
// verify attendance against.
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

    const body = await req.json().catch(() => ({}))
    const companionTagId = typeof body?.companionTagId === 'string' ? body.companionTagId : ''
    if (!companionTagId) {
      return NextResponse.json({ ok: false, reason: 'EMPTY', message: 'companionTagId is required.' }, { status: 400 })
    }

    const tag = await prisma.companionTag.findUnique({
      where: { id: companionTagId },
      include: { booking: true, taggedUser: { select: { name: true, displayName: true } } },
    })

    if (!tag) {
      return NextResponse.json({ ok: false, reason: 'NOT_FOUND', message: 'No companion tag matches this id.' }, { status: 404 })
    }
    if (tag.booking.eventId !== eventId) {
      return NextResponse.json({ ok: false, reason: 'WRONG_EVENT', message: 'This tag is for a different event.' }, { status: 409 })
    }
    if (tag.status !== 'ACCEPTED') {
      return NextResponse.json({
        ok: false,
        reason: 'NOT_ACCEPTED',
        message: `This companion hasn't confirmed the tag yet (status: ${tag.status}).`,
      }, { status: 409 })
    }
    if (tag.checkedInAt) {
      return NextResponse.json({
        ok: false,
        reason: 'ALREADY_CHECKED_IN',
        message: 'Already checked in.',
        attendeeName: tag.taggedUser.displayName || tag.taggedUser.name,
        checkedInAt: tag.checkedInAt,
      }, { status: 409 })
    }

    const updated = await prisma.companionTag.update({
      where: { id: companionTagId },
      data: { checkedInAt: new Date(), checkedInByUserId: user.id },
    })

    return NextResponse.json({
      ok: true,
      attendeeName: tag.taggedUser.displayName || tag.taggedUser.name,
      checkedInAt: updated.checkedInAt,
    })
  } catch (err) {
    console.error('Error checking in companion:', err)
    return NextResponse.json({ ok: false, reason: 'ERROR', message: 'Check-in failed.' }, { status: 500 })
  }
}
