import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { resolveConversationContext, getOrCreateConversation } from '@/lib/messaging'
import type { ConversationContextType } from '@prisma/client'

const VALID_TYPES: ConversationContextType[] = ['PERFORMANCE', 'VENUE_BOOKING', 'BOOKING']

// "Message Organiser" / "Message Venue Owner" / "Message Artist" buttons
// all call this - it's the one entry point that finds an existing
// thread or creates one, after checking the caller actually belongs to
// that relationship. Idempotent, so a page can call this every time the
// button is clicked without worrying about duplicate threads.
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id as string

    const { contextType, contextId } = await req.json()
    if (!VALID_TYPES.includes(contextType) || !contextId) {
      return NextResponse.json({ error: 'Invalid contextType or contextId' }, { status: 400 })
    }

    const context = await resolveConversationContext(contextType, contextId)
    if (!context) {
      return NextResponse.json(
        { error: 'This conversation is not available yet - it needs a confirmed booking first.' },
        { status: 404 }
      )
    }
    if (!context.participantUserIds.includes(userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const conversation = await getOrCreateConversation(contextType, contextId, context.participantUserIds)
    return NextResponse.json({ conversationId: conversation.id, label: context.label })
  } catch (err) {
    console.error('Error starting conversation:', err)
    return NextResponse.json({ error: 'Failed to start conversation' }, { status: 500 })
  }
}
