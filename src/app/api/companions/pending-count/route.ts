import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// BUG-2608-032 - companion-tag creation already fires a one-shot push
// (see bookings/[id]/companions/route.ts PATCH), but that's easy to miss
// and there was no persistent reminder anywhere after it's dismissed.
// Mirrors /api/conversations/unread-count's pattern exactly - a cheap
// count-only endpoint for the SiteNav badge, separate from
// /api/companions/mine (which the /tickets inbox itself uses and
// includes taggedBy/booking/event joins too heavy to run on every page).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ count: 0 })
  const userId = (session.user as any).id as string

  const count = await prisma.companionTag.count({
    where: { taggedUserId: userId, status: 'PENDING' },
  })

  return NextResponse.json({ count })
}
