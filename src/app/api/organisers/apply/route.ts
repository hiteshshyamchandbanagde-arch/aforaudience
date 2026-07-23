import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToRole, notifyAfterResponse } from '@/lib/push'

// Multi-role support: a person can hold an Organiser profile alongside
// another active role (e.g. a Venue Owner who also wants to run their own
// events) - previously hard-blocked with "You're already registered as X,
// and can't apply for a second role right now." Only ADMIN is excluded
// from self-serve applications; every other role can apply for an
// additional one they don't already hold.
//
// Role-switching safety: `user.role` is only flipped immediately when the
// applicant is a true first-timer (starting role AUDIENCE) - matching the
// existing first-role behavior exactly. Anyone who already has an active
// role keeps it untouched here; switching to the new role (once approved)
// happens explicitly via POST /api/users/me/switch-role, so applying for
// a second role can never silently kick someone out of their current
// dashboard mid-session.
export async function POST(req: Request) {
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

  const existing = await prisma.organiser.findUnique({ where: { userId: user.id } })
  if (existing) {
    return NextResponse.json({ error: 'You already have an Organiser account.' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const orgName = typeof body?.orgName === 'string' ? body.orgName.trim() : ''
  if (!orgName) {
    return NextResponse.json({ error: 'Organisation / brand name is required.' }, { status: 400 })
  }

  const isFirstRole = user.role === 'AUDIENCE'

  await prisma.$transaction([
    ...(isFirstRole ? [prisma.user.update({ where: { id: user.id }, data: { role: 'ORGANISER' as const } })] : []),
    prisma.organiser.create({ data: { userId: user.id, orgName, bio: body?.bio || null, isApproved: false } }),
  ])

  // Scheduled via after() so it can't be silently frozen mid-flight when
  // the response is returned - a bare fire-and-forget call here was
  // dropping this notification intermittently with zero trace.
  notifyAfterResponse(
    () =>
      sendPushToRole('ADMIN', {
        title: 'New Organiser application',
        body: `${orgName} applied to become an Organiser.`,
        url: '/dashboard/admin',
      }),
    'organiser-apply'
  )

  return NextResponse.json({
    message: isFirstRole
      ? 'Application submitted. We review new Organiser applications before you can create events.'
      : "Application submitted. Once approved, you'll be able to switch to your Organiser dashboard from your Profile - your current account stays exactly as it is until then.",
  })
}
