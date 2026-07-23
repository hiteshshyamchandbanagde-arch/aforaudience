import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Used by the Organiser dashboard to tell apart three states that were
// previously all collapsed into the same "Failed to fetch events" error:
// not an Organiser at all, Organiser but not yet approved, or approved.
//
// Checks profile existence directly rather than gating on
// `user.role === 'ORGANISER'` first - a person can hold an Organiser
// profile while their currently *active* role is something else (e.g. a
// Venue Owner who also applied to become an Organiser), and this status
// needs to be visible regardless of which role is currently active so the
// Profile page can offer a "switch to this dashboard" action.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organiser = await prisma.organiser.findUnique({ where: { userId: user.id } })

  return NextResponse.json({
    isOrganiser: !!organiser,
    hasProfile: !!organiser,
    isApproved: organiser?.isApproved ?? false,
    isActive: user.role === 'ORGANISER',
    orgName: organiser?.orgName ?? null,
  })
}
