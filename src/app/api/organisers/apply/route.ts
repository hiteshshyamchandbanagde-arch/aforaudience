import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.role === 'ORGANISER') {
    return NextResponse.json({ error: 'You already have an Organiser account.' }, { status: 400 })
  }
  if (user.role !== 'AUDIENCE') {
    return NextResponse.json({ error: `You're already registered as ${user.role.replace('_', ' ').toLowerCase()}, and can't apply for a second role right now.` }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const orgName = typeof body?.orgName === 'string' ? body.orgName.trim() : ''
  if (!orgName) {
    return NextResponse.json({ error: 'Organisation / brand name is required.' }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { role: 'ORGANISER' } }),
    prisma.organiser.create({ data: { userId: user.id, orgName, bio: body?.bio || null, isApproved: false } }),
  ])

  return NextResponse.json({ message: 'Application submitted. We review new Organiser applications before you can create events.' })
}
