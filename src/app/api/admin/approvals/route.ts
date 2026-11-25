import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  return user?.role === 'ADMIN' ? user : null
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [organisers, venueOwners] = await Promise.all([
    prisma.organiser.findMany({
      where: { isApproved: false },
      include: { user: { select: { name: true, email: true, createdAt: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.venueOwner.findMany({
      where: { isApproved: false },
      include: { user: { select: { name: true, email: true, createdAt: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  return NextResponse.json({ organisers, venueOwners })
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { type, id, action } = await req.json()
  if (!['organiser', 'venueOwner'].includes(type) || !['approve', 'reject'].includes(action) || !id) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (type === 'organiser') {
    const organiser = await prisma.organiser.findUnique({ where: { id } })
    if (!organiser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (action === 'approve') {
      await prisma.organiser.update({ where: { id }, data: { isApproved: true } })
    } else {
      // No REJECTED status exists on the model - cleanest handling without a
      // schema change is to remove the sub-profile and drop the user back to
      // AUDIENCE, so they can browse normally and reapply later if they want.
      await prisma.$transaction([
        prisma.organiser.delete({ where: { id } }),
        prisma.user.update({ where: { id: organiser.userId }, data: { role: 'AUDIENCE' } }),
      ])
    }

    // Closes the loop this session started with (admin gets notified of
    // the application; this is the applicant learning the outcome, which
    // didn't exist at all before - they'd have had to keep checking the
    // dashboard manually).
    notifyAfterResponse(
      () =>
        sendPushToUser(organiser.userId, {
          title: action === 'approve' ? "You're approved as an Organiser!" : 'Organiser application update',
          body:
            action === 'approve'
              ? "You can now create and manage events on AforAudience."
              : "Your Organiser application wasn't approved this time.",
          url: action === 'approve' ? '/dashboard/organiser' : '/profile',
        }),
      'organiser-decision'
    )
  } else {
    const venueOwner = await prisma.venueOwner.findUnique({ where: { id } })
    if (!venueOwner) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (action === 'approve') {
      await prisma.venueOwner.update({ where: { id }, data: { isApproved: true } })
    } else {
      await prisma.$transaction([
        prisma.venueOwner.delete({ where: { id } }),
        prisma.user.update({ where: { id: venueOwner.userId }, data: { role: 'AUDIENCE' } }),
      ])
    }

    notifyAfterResponse(
      () =>
        sendPushToUser(venueOwner.userId, {
          title: action === 'approve' ? "You're approved as a Venue Owner!" : 'Venue Owner application update',
          body:
            action === 'approve'
              ? "You can now list your venue on AforAudience."
              : "Your Venue Owner application wasn't approved this time.",
          url: action === 'approve' ? '/dashboard/venue' : '/profile',
        }),
      'venue-owner-decision'
    )
  }

  return NextResponse.json({ message: 'Updated' })
}
