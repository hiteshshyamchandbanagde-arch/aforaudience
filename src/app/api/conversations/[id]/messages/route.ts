import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { resolveConversationContext } from '@/lib/messaging'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'

// GET fetches the thread and, as a side effect, marks it read for the
// caller (lastReadAt = now) - opening a thread is the "read" action,
// same as any messaging app, no separate mark-read endpoint needed.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id as string

    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: id, userId } },
    })
    if (!participant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        participants: { include: { user: { select: { id: true, name: true, displayName: true } } } },
      },
    })
    if (!conversation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const context = await resolveConversationContext(conversation.contextType, conversation.contextId).catch(
      () => null
    )

    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: id, userId } },
      data: { lastReadAt: new Date() },
    })

    return NextResponse.json({
      conversationId: conversation.id,
      contextType: conversation.contextType,
      label: context?.label ?? null,
      isActive: context ? !context.activeUntil || context.activeUntil > new Date() : false,
      participants: conversation.participants.map((p) => p.user),
      messages: conversation.messages,
    })
  } catch (err) {
    console.error('Error fetching conversation messages:', err)
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id as string

    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: id, userId } },
      include: { conversation: true },
    })
    if (!participant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { body } = await req.json()
    const text = typeof body === 'string' ? body.trim() : ''
    if (!text) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
    }
    // Generous but real cap - matches the pattern used elsewhere in this
    // app (Dress Code "Other" field, Feedback message) of always having
    // *some* server-side bound rather than trusting the client's.
    if (text.length > 2000) {
      return NextResponse.json({ error: 'Message is too long (max 2000 characters).' }, { status: 400 })
    }

    const context = await resolveConversationContext(
      participant.conversation.contextType,
      participant.conversation.contextId
    )
    if (context?.activeUntil && context.activeUntil < new Date()) {
      return NextResponse.json({ error: 'This conversation has closed - the event is over.' }, { status: 403 })
    }

    const [message] = await prisma.$transaction([
      prisma.message.create({ data: { conversationId: id, senderId: userId, body: text } }),
      prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } }),
    ])

    const otherParticipants = await prisma.conversationParticipant.findMany({
      where: { conversationId: id, userId: { not: userId } },
    })

    notifyAfterResponse(async () => {
      const sender = await prisma.user.findUnique({ where: { id: userId } })
      const senderName = sender?.displayName ?? sender?.name ?? 'Someone'
      for (const other of otherParticipants) {
        await sendPushToUser(other.userId, {
          title: `New message from ${senderName}`,
          body: text.length > 120 ? `${text.slice(0, 117)}...` : text,
          url: `/dashboard/messages/${id}`,
        })
      }
    }, 'new-message')

    return NextResponse.json(message, { status: 201 })
  } catch (err) {
    console.error('Error sending message:', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
