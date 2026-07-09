import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Lists Flexible-venue negotiation requests relevant to the logged-in
// user - their own requests if they're the Organiser who sent them, or
// requests against their venues if they're the Venue Owner receiving them.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const include = {
    venue: { select: { id: true, name: true, city: true } },
    event: { select: { id: true, title: true, date: true } },
    organiser: { select: { orgName: true, user: { select: { name: true, email: true } } } },
    offers: { orderBy: { createdAt: 'asc' as const } },
  }

  if (user.role === 'ORGANISER') {
    const organiser = await prisma.organiser.findUnique({ where: { userId: user.id } })
    if (!organiser) return NextResponse.json([])
    const requests = await prisma.venueBookingRequest.findMany({
      where: { organiserId: organiser.id },
      include,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(requests)
  }

  if (user.role === 'VENUE_OWNER') {
    const venueOwner = await prisma.venueOwner.findUnique({ where: { userId: user.id } })
    if (!venueOwner) return NextResponse.json([])
    const requests = await prisma.venueBookingRequest.findMany({
      where: { venue: { ownerId: venueOwner.id } },
      include,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(requests)
  }

  return NextResponse.json([])
}
