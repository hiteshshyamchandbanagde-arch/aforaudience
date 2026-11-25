import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'

// Owner-only reply, one level deep - matches the notification logic
// already in POST /api/reviews: a performance-specific review's owner is
// that Artist; a general event review's owner is the event's Organiser.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id

  const review = await prisma.review.findUnique({
    where: { id },
    include: {
      performance: { include: { artist: true } },
      event: { include: { organiser: true } },
      reply: true,
      user: { select: { name: true, displayName: true } },
    },
  })
  if (!review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }

  const ownerUserId = review.performance ? review.performance.artist.userId : review.event.organiser.userId
  if (ownerUserId !== userId) {
    return NextResponse.json({ error: 'Only the reviewed Artist/Organiser can reply to this review' }, { status: 403 })
  }

  if (review.reply) {
    return NextResponse.json({ error: 'Already replied to this review' }, { status: 409 })
  }

  const body = await req.json()
  const text = String(body.text || '').trim()
  if (!text) {
    return NextResponse.json({ error: 'Reply text is required' }, { status: 400 })
  }
  if (text.length > 500) {
    return NextResponse.json({ error: 'Reply must be 500 characters or fewer' }, { status: 400 })
  }

  const reply = await prisma.reviewReply.create({
    data: { reviewId: id, authorId: userId, text },
  })

  const replier = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, displayName: true } })
  const authorLabel = replier?.displayName || replier?.name || 'They'

  notifyAfterResponse(async () => {
    await sendPushToUser(review.userId, {
      title: 'Reply to your review',
      body: `${authorLabel} replied: "${text.slice(0, 80)}"`,
      url: `/events/${review.eventId}`,
    })
  }, 'review-reply')

  return NextResponse.json(reply, { status: 201 })
}
