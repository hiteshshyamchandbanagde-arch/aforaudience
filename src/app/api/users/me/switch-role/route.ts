import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

const SWITCHABLE_ROLES = ['ARTIST', 'ORGANISER', 'VENUE_OWNER'] as const
type SwitchableRole = (typeof SWITCHABLE_ROLES)[number]

// Explicitly switches a user's ACTIVE role to one they already hold an
// approved profile for. This is the second half of multi-role support -
// applying (POST /api/organisers/apply etc.) creates a profile without
// touching the active role unless it's a true first-role application;
// this endpoint is the only thing that ever changes an already-active
// role, and only to a role the user is genuinely approved for. Every
// existing role-gated route elsewhere in the app (event/venue creation,
// bookings, etc.) keeps checking the single active `user.role` exactly as
// before - this endpoint is what that field is.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const targetRole = body?.role as string
  if (!SWITCHABLE_ROLES.includes(targetRole as SwitchableRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  if (user.role === targetRole) {
    return NextResponse.json({ error: 'That is already your active role.' }, { status: 400 })
  }

  if (targetRole === 'ARTIST') {
    const artist = await prisma.artist.findUnique({ where: { userId: user.id } })
    if (!artist) {
      return NextResponse.json({ error: "You don't have an Artist profile yet." }, { status: 403 })
    }
  } else if (targetRole === 'ORGANISER') {
    const organiser = await prisma.organiser.findUnique({ where: { userId: user.id } })
    if (!organiser) {
      return NextResponse.json({ error: "You don't have an Organiser profile yet." }, { status: 403 })
    }
    if (!organiser.isApproved) {
      return NextResponse.json({ error: 'Your Organiser application is still pending approval.' }, { status: 403 })
    }
  } else if (targetRole === 'VENUE_OWNER') {
    const venueOwner = await prisma.venueOwner.findUnique({ where: { userId: user.id } })
    if (!venueOwner) {
      return NextResponse.json({ error: "You don't have a Venue Owner profile yet." }, { status: 403 })
    }
    if (!venueOwner.isApproved) {
      return NextResponse.json({ error: 'Your Venue Owner application is still pending approval.' }, { status: 403 })
    }
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: targetRole as SwitchableRole } })

  return NextResponse.json({ role: targetRole })
}
