import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

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
  }

  return NextResponse.json({ message: 'Updated' })
}
