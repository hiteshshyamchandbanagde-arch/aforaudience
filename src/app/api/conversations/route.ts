import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { resolveConversationContext } from '@/lib/messaging'

// Lists every thread the current user is a participant in, across all
// three context types (Artist<->Organiser, Organiser<->Venue Owner,
// Audience<->Organiser) - one inbox, not three separate pages. See
// design.md §9.4.
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id as string

    const participations = await prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
            participants: { include: { user: { select: { id: true, name: true, displayName: true } } } },
          },
        },
      },
    })

    const threads = await Promise.all(
      participations.map(async (p) => {
        const conv = p.conversation
        const lastMessage = conv.messages[0] ?? null
        const otherParticipant = conv.participants.find((cp) => cp.userId !== userId)?.user ?? null
        const unread = Boolean(
          lastMessage &&
            lastMessage.senderId !== userId &&
            (!p.lastReadAt || lastMessage.createdAt > p.lastReadAt)
        )
        // Best-effort label (event title / venue name). Falls back to
        // null rather than failing the whole list if the underlying
        // record was somehow removed - a thread with old messages
        // should still be readable even if its context vanished.
        const context = await resolveConversationContext(conv.contextType, conv.contextId).catch(() => null)
        return {
          conversationId: conv.id,
          contextType: conv.contextType,
          contextId: conv.contextId,
          label: context?.label ?? null,
          isActive: context ? (!context.activeUntil || context.activeUntil > new Date()) : false,
          otherParticipant,
          lastMessage: lastMessage
            ? { body: lastMessage.body, createdAt: lastMessage.createdAt, senderId: lastMessage.senderId }
            : null,
          unread,
          updatedAt: conv.updatedAt,
        }
      })
    )

    // Most recently active thread first - matches how every other list
    // in this app orders (newest activity, not creation order).
    threads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    return NextResponse.json(threads)
  } catch (err) {
    console.error('Error listing conversations:', err)
    return NextResponse.json({ error: 'Failed to load conversations' }, { status: 500 })
  }
}
