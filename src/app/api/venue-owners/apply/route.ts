import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToRole } from '@/lib/push'

// The opt-in upgrade path referenced throughout the design doc but never
// built until now: an AUDIENCE user applies here, gets flipped to
// VENUE_OWNER with an unapproved VenueOwner profile, and shows up in the
// Admin approval queue. No self-serve path to approval - that's the point.
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.role === 'VENUE_OWNER') {
    return NextResponse.json({ error: 'You already have a Venue Owner account.' }, { status: 400 })
  }
  if (user.role !== 'AUDIENCE') {
    return NextResponse.json({ error: `You're already registered as ${user.role.replace('_', ' ').toLowerCase()}, and can't apply for a second role right now.` }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { role: 'VENUE_OWNER' } }),
    prisma.venueOwner.create({ data: { userId: user.id, isApproved: false } }),
  ])

  sendPushToRole('ADMIN', {
    title: 'New Venue Owner application',
    body: `${user.displayName || user.name} applied to become a Venue Owner.`,
    url: '/dashboard/admin',
  }).catch((err) => console.error('[push] venue-owner-apply notify failed', err))

  return NextResponse.json({ message: 'Application submitted. We review new Venue Owner applications before you can list a venue.' })
}
