import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/companions/mine
//
// Companion Tagging Phase 1 (reputation epic §7) - tags where the
// caller is the *tagged* person, not the booker. Only PENDING by
// default (the "you've been tagged" inbox on /tickets) - pass
// ?all=1 to also see tags you've already responded to, or
// ?status=ACCEPTED to see only confirmed ones.
//
// BUG-2608-033 - ?status=ACCEPTED added so /tickets can render a
// companion's confirmed tags as their own ticket-like entries. Before
// this, an ACCEPTED tag fell out of every view once it left the
// PENDING-only default here, and the tagged person's own booking list
// (/api/bookings/my) never included it either since they never have a
// Booking row of their own - accepting a tag genuinely produced no
// visible "ticket" anywhere.
const VALID_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED'] as const
type TagStatus = (typeof VALID_STATUSES)[number]

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id

  const { searchParams } = new URL(req.url)
  const includeAll = searchParams.get('all') === '1'
  const statusParam = searchParams.get('status')
  const status: TagStatus | null =
    statusParam && (VALID_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as TagStatus) : null

  const tags = await prisma.companionTag.findMany({
    where: {
      taggedUserId: userId,
      ...(includeAll ? {} : status ? { status } : { status: 'PENDING' }),
    },
    include: {
      taggedBy: { select: { id: true, name: true, displayName: true } },
      booking: {
        select: {
          id: true,
          event: { select: { id: true, title: true, date: true, startTime: true, venue: { select: { name: true, city: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ tags })
}
