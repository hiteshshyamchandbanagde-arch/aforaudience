import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser } from '@/lib/push'

// PATCH /api/companions/[tagId]/respond
// body: { accept: boolean }
//
// Companion Tagging Phase 1 (reputation epic §7) - only the tagged user
// can respond to their own tag. This is the handshake that lets a tag
// eventually count toward Verified/Repeat Attendee counts and Scene
// Status for the tagged person - being named by someone else's booking
// is never enough on its own.
export async function PATCH(req: Request, { params }: { params: Promise<{ tagId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id
  const { tagId } = await params

  const body = await req.json().catch(() => ({}))
  if (typeof body.accept !== 'boolean') {
    return NextResponse.json({ error: 'accept (boolean) is required' }, { status: 400 })
  }

  const tag = await prisma.companionTag.findUnique({
    where: { id: tagId },
    include: {
      taggedUser: { select: { name: true, displayName: true } },
      booking: { select: { event: { select: { title: true } } } },
    },
  })
  if (!tag) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
  }
  if (tag.taggedUserId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (tag.status !== 'PENDING') {
    return NextResponse.json({ error: 'This tag has already been responded to' }, { status: 409 })
  }

  const updated = await prisma.companionTag.update({
    where: { id: tagId },
    data: { status: body.accept ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() },
  })

  // BUG-2608-034 - the booker was never told their companion had
  // responded at all (this route had zero notification logic). Same
  // best-effort "don't fail the request over a push" pattern as the tag
  // creation notify in bookings/[id]/companions/route.ts.
  const responderName = tag.taggedUser.displayName || tag.taggedUser.name
  const eventTitle = tag.booking.event.title
  sendPushToUser(tag.taggedByUserId, {
    title: body.accept ? 'Companion confirmed' : 'Companion declined',
    body: body.accept
      ? `${responderName} confirmed they're coming to ${eventTitle}.`
      : `${responderName} declined your companion tag for ${eventTitle}.`,
    url: '/tickets',
  }).catch((err) => console.error('[companions/respond] notify booker failed', err))

  return NextResponse.json({ tag: updated })
}
