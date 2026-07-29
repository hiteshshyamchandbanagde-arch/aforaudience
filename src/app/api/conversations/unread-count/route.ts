import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Feedback 45ac402a (29 Jul): no nav entry point into Messages at all -
// confirmed via code, not just Dimple's report, that this was true for
// every role, not only Organiser (SiteNav's accountLinks never included
// it). This endpoint powers the badge on the new nav link. Deliberately
// separate from GET /api/conversations (which the /dashboard/messages
// inbox itself uses) rather than reusing it here - that route resolves
// each thread's context label with a per-thread lookup, which is fine
// for loading the inbox once but too heavy to run on every page via
// SiteNav. Same "unread" definition as that route (last message not
// from me, and newer than my lastReadAt), just without the label lookup.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ count: 0 })
  const userId = (session.user as any).id as string

  const participations = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: {
      lastReadAt: true,
      conversation: {
        select: {
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { senderId: true, createdAt: true } },
        },
      },
    },
  })

  const count = participations.filter((p: (typeof participations)[number]) => {
    const last = p.conversation.messages[0]
    return last && last.senderId !== userId && (!p.lastReadAt || last.createdAt > p.lastReadAt)
  }).length

  return NextResponse.json({ count })
}
