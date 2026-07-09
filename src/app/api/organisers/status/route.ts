import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Used by the Organiser dashboard to tell apart three states that were
// previously all collapsed into the same "Failed to fetch events" error:
// not an Organiser at all, Organiser but not yet approved, or approved.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.role !== 'ORGANISER') {
    return NextResponse.json({ isOrganiser: false, hasProfile: false, isApproved: false })
  }

  const organiser = await prisma.organiser.findUnique({ where: { userId: user.id } })

  return NextResponse.json({
    isOrganiser: true,
    hasProfile: !!organiser,
    isApproved: organiser?.isApproved ?? false,
    orgName: organiser?.orgName ?? null,
  })
}
