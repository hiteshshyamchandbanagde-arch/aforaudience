import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isFlexRequestWaitingOn } from '@/lib/flex-requests'

// BUG-2609-073 - the Flexible Requests badge, one count per held role:
// only requests waiting on this user's action on that side (PENDING, the
// other side made the last offer). A user who is both an Organiser and a
// Venue Owner gets each side's own count, not the same list twice.
export async function GET() {
  const empty = { ORGANISER: 0, VENUE_OWNER: 0 }
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return NextResponse.json(empty)

  const [organiser, venueOwner] = await Promise.all([
    prisma.organiser.findUnique({ where: { userId }, select: { id: true } }),
    prisma.venueOwner.findUnique({ where: { userId }, select: { id: true } }),
  ])
  const select = { status: true, offers: { select: { proposedBy: true, createdAt: true }, orderBy: { createdAt: 'asc' as const } } }
  const [asOrganiser, asVenueOwner] = await Promise.all([
    organiser ? prisma.venueBookingRequest.findMany({ where: { organiserId: organiser.id, status: 'PENDING' }, select }) : [],
    venueOwner ? prisma.venueBookingRequest.findMany({ where: { venue: { ownerId: venueOwner.id }, status: 'PENDING' }, select }) : [],
  ])
  const now = Date.now()
  return NextResponse.json({
    ORGANISER: asOrganiser.filter((r) => isFlexRequestWaitingOn(r, 'ORGANISER', now)).length,
    VENUE_OWNER: asVenueOwner.filter((r) => isFlexRequestWaitingOn(r, 'VENUE_OWNER', now)).length,
  })
}
