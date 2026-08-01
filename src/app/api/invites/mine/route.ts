import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/invites/mine
//
// Accept-to-Appear (§8, session 57) - combined inbox for both invite
// types, same "You've been tagged" pattern §7's companion tagging already
// established for /tickets. Only ever returns the current user's own
// PENDING invites - ACCEPTED/DECLINED ones are done, nothing to act on.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id

  const [panelistInvites, celebrityInvites] = await Promise.all([
    prisma.eventPanelist.findMany({
      where: { userId, status: 'PENDING' },
      include: { event: { select: { id: true, title: true, date: true, organiser: { select: { user: { select: { name: true, displayName: true } } } } } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.celebrity.findMany({
      where: { userId, status: 'PENDING' },
      include: { event: { select: { id: true, title: true, date: true, organiser: { select: { user: { select: { name: true, displayName: true } } } } } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return NextResponse.json({ panelistInvites, celebrityInvites })
}
