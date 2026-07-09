import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user || user.role !== 'ADMIN') return null
  return user
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

  const pending = [
    ...organisers.map((o: any) => ({ type: 'ORGANISER' as const, id: o.id, orgName: o.orgName, bio: o.bio, user: o.user, createdAt: o.createdAt })),
    ...venueOwners.map((v: any) => ({ type: 'VENUE_OWNER' as const, id: v.id, user: v.user, createdAt: v.createdAt })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  return NextResponse.json(pending)
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { type, id, action } = await req.json()

  if (!['ORGANISER', 'VENUE_OWNER'].includes(type) || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const model = type === 'ORGANISER' ? prisma.organiser : prisma.venueOwner

  if (action === 'approve') {
    await model.update({ where: { id }, data: { isApproved: true } })
    return NextResponse.json({ message: 'Approved' })
  }

  // Reject: remove the sub-record and revert the user back to AUDIENCE, so
  // they see "not registered as X" again and can re-apply if they want to.
  const record = await (model as any).findUnique({ where: { id } })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.$transaction([
    (model as any).delete({ where: { id } }),
    prisma.user.update({ where: { id: record.userId }, data: { role: 'AUDIENCE' } }),
  ])

  return NextResponse.json({ message: 'Rejected' })
}
