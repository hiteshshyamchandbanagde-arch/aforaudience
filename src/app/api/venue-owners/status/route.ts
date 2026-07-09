import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Mirrors /api/organisers/status - see that file for the reasoning.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.role !== 'VENUE_OWNER') {
    return NextResponse.json({ isVenueOwner: false, hasProfile: false, isApproved: false })
  }

  const venueOwner = await prisma.venueOwner.findUnique({ where: { userId: user.id } })

  return NextResponse.json({
    isVenueOwner: true,
    hasProfile: !!venueOwner,
    isApproved: venueOwner?.isApproved ?? false,
  })
}
