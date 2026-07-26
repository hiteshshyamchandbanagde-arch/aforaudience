import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getOrCreateConversation, resolveConversationContext } from '@/lib/messaging'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'

// Organiser -> all Artists in a lineup. Fan-out, not a group chat
// (Hitesh's call, design.md §9.4): the same message text lands as a
// separate Message in each artist's own private PERFORMANCE thread
// with this organiser. Replies stay private to that 1:1 thread - no
// other artist in the lineup ever sees them.
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id as string

    const { eventId, body } = await req.json()
    const text = typeof body === 'string' ? body.trim() : ''
    if (!eventId || !text) {
      return NextResponse.json({ error: 'eventId and body are required' }, { status: 400 })
    }
    if (text.length > 2000) {
      return NextResponse.json({ error: 'Message is too long (max 2000 characters).' }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organiser: true,
        lineup: { where: { cancelledAt: null }, include: { artist: true } },
      },
    })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    if (event.organiser.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (event.lineup.length === 0) {
      return NextResponse.json({ error: 'This event has no active lineup to message.' }, { status: 400 })
    }

    const results = await Promise.all(
      event.lineup.map(async (performance) => {
        const context = await resolveConversationContext('PERFORMANCE', performance.id)
        if (!context) return null
        const conversation = await getOrCreateConversation('PERFORMANCE', performance.id, context.participantUserIds)
        const message = await prisma.message.create({
          data: { conversationId: conversation.id, senderId: userId, body: text },
        })
        await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } })
        return { performanceId: performance.id, artistUserId: performance.artist.userId, messageId: message.id }
      })
    )

    const sent = results.filter((r): r is NonNullable<typeof r> => r !== null)

    notifyAfterResponse(async () => {
      for (const r of sent) {
        await sendPushToUser(r.artistUserId, {
          title: `Message from ${event.organiser ? 'the organiser' : 'organiser'}`,
          body: `${event.title}: ${text.length > 100 ? `${text.slice(0, 97)}...` : text}`,
          url: '/dashboard/artist/messages',
        })
      }
    }, 'broadcast-message')

    return NextResponse.json({ sentTo: sent.length })
  } catch (err) {
    console.error('Error broadcasting message:', err)
    return NextResponse.json({ error: 'Failed to broadcast message' }, { status: 500 })
  }
}
