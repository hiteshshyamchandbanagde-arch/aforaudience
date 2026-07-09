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

  if (user.role === 'ARTIST') {
    return NextResponse.json({ error: 'You already have an Artist account.' }, { status: 400 })
  }
  if (user.role !== 'AUDIENCE') {
    return NextResponse.json({ error: `You're already registered as ${user.role.replace('_', ' ').toLowerCase()}, and can't apply for a second role right now.` }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const genre = typeof body?.genre === 'string'
    ? body.genre.split(',').map((g: string) => g.trim()).filter(Boolean)
    : []

  // No Admin approval gate here, unlike Organiser/Venue Owner - the design
  // doc's admin-approval list only covers those two roles. Artist goes
  // live immediately.
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { role: 'ARTIST' } }),
    prisma.artist.create({ data: { userId: user.id, genre, styleTag: [], videoReel: [] } }),
  ])

  return NextResponse.json({ message: "You're all set — your Artist profile is live. Head to your dashboard to fill in the rest and start applying to events." })
}
