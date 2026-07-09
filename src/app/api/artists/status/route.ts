import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Matches /api/organisers/status and /api/venue-owners/status - except
// Artist never needs isApproved (no Admin review for this role, per the
// design doc: only Organiser/Venue Owner are gated). Included in the
// response shape anyway, always true once hasProfile is true, so the
// Profile page can use one consistent RoleStatus type for all three.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.role !== 'ARTIST') {
    return NextResponse.json({ isArtist: false, hasProfile: false, isApproved: false })
  }

  const artist = await prisma.artist.findUnique({ where: { userId: user.id } })

  return NextResponse.json({
    isArtist: true,
    hasProfile: !!artist,
    isApproved: true,
  })
}
