import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// The opt-in-upgrade flow: an AUDIENCE user applies to become an Organiser
// or Venue Owner. Role flips immediately (so the dashboards/status
// endpoints built for B7 correctly show "pending"), but the sub-record's
// isApproved starts false - an Admin has to approve before they can
// actually create events or venues (enforced in POST /api/events and
// POST /api/venues already).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only AUDIENCE members can apply this way - prevents someone already in
  // a role (or an Admin) from silently overwriting their account by
  // resubmitting this form.
  if (user.role !== 'AUDIENCE') {
    return NextResponse.json({ error: 'Only Audience accounts can apply for a role upgrade' }, { status: 403 })
  }

  const body = await req.json()
  const { role, orgName, bio } = body

  if (role === 'ORGANISER') {
    if (!orgName || !orgName.trim()) {
      return NextResponse.json({ error: 'Organisation name is required' }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { role: 'ORGANISER' } }),
      prisma.organiser.create({
        data: { userId: user.id, orgName: orgName.trim(), bio: bio?.trim() || null, isApproved: false },
      }),
    ])

    return NextResponse.json({ message: 'Application submitted. Pending Admin approval.' }, { status: 201 })
  }

  if (role === 'VENUE_OWNER') {
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { role: 'VENUE_OWNER' } }),
      prisma.venueOwner.create({ data: { userId: user.id, isApproved: false } }),
    ])

    return NextResponse.json({ message: 'Application submitted. Pending Admin approval.' }, { status: 201 })
  }

  return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
}
