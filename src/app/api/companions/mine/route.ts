import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/companions/mine
//
// Companion Tagging Phase 1 (reputation epic §7) - tags where the
// caller is the *tagged* person, not the booker. Only PENDING by
// default (the "you've been tagged" inbox on /tickets) - pass
// ?all=1 to also see tags you've already responded to.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id

  const { searchParams } = new URL(req.url)
  const includeAll = searchParams.get('all') === '1'

  const tags = await prisma.companionTag.findMany({
    where: { taggedUserId: userId, ...(includeAll ? {} : { status: 'PENDING' }) },
    include: {
      taggedBy: { select: { id: true, name: true, displayName: true } },
      booking: {
        select: {
          id: true,
          event: { select: { id: true, title: true, date: true, startTime: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ tags })
}
