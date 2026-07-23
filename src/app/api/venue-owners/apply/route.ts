import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToRole, notifyAfterResponse } from '@/lib/push'

// Multi-role support - mirrors /api/organisers/apply exactly, see that
// file for the full reasoning (only ADMIN excluded from self-serve
// applications; role only auto-flips for true first-timers; switching to
// an already-approved second role happens explicitly via
// POST /api/users/me/switch-role).
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.role === 'ADMIN') {
    return NextResponse.json({ error: "Admin accounts can't apply for a second role." }, { status: 400 })
  }

  const existing = await prisma.venueOwner.findUnique({ where: { userId: user.id } })
  if (existing) {
    return NextResponse.json({ error: 'You already have a Venue Owner account.' }, { status: 400 })
  }

  const isFirstRole = user.role === 'AUDIENCE'

  await prisma.$transaction([
    ...(isFirstRole ? [prisma.user.update({ where: { id: user.id }, data: { role: 'VENUE_OWNER' as const } })] : []),
    prisma.venueOwner.create({ data: { userId: user.id, isApproved: false } }),
  ])

  notifyAfterResponse(
    () =>
      sendPushToRole('ADMIN', {
        title: 'New Venue Owner application',
        body: `${user.displayName || user.name} applied to become a Venue Owner.`,
        url: '/dashboard/admin',
      }),
    'venue-owner-apply'
  )

  return NextResponse.json({
    message: isFirstRole
      ? 'Application submitted. We review new Venue Owner applications before you can list a venue.'
      : "Application submitted. Once approved, you'll be able to switch to your Venue dashboard from your Profile - your current account stays exactly as it is until then.",
  })
}
