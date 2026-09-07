import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Mobile Redesign Phase 4b (GEN-2609-007) - the current user's saved
// (Follow targetType=EVENT) events, shaped identically to GET /api/events
// so the client can hand the response straight to the same EventCard/
// EventItem the Discover page already uses - no separate type needed.
//
// Known gap, not silently papered over: /api/events' GET recomputes
// totalSeats/availableSeats for NUMBERED venues from live Seat/
// BookingSeat rows (that correction is ~40 lines inline in that route,
// not extracted into a shared helper) - this route returns the Event
// row's own stored columns instead, same as every other EventItem
// consumer in this codebase besides that one route. Availability badges
// on a wishlist page are secondary information, not a booking surface,
// so this is a reasonable place to accept that gap rather than take on
// extracting shared logic as part of this phase.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const saves = await prisma.follow.findMany({
    where: { userId: (session.user as any).id, targetType: 'EVENT' },
    select: { targetId: true },
  })
  const eventIds = saves.map((s) => s.targetId)
  if (eventIds.length === 0) return NextResponse.json([])

  const events = await prisma.event.findMany({
    where: { id: { in: eventIds } },
    include: { venue: true, lineup: { include: { artist: { select: { id: true, user: { select: { name: true, displayName: true } } } } } } },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json(events)
}
