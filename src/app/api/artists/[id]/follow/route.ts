import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ following: false })
  }

  const existing = await prisma.follow.findUnique({
    where: { userId_artistId: { userId: (session.user as any).id, artistId: id } },
  })
  return NextResponse.json({ following: !!existing })
}

// Toggle - follows if not already following, unfollows if already following.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id

  const artist = await prisma.artist.findUnique({ where: { id } })
  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  const existing = await prisma.follow.findUnique({
    where: { userId_artistId: { userId, artistId: id } },
  })

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } })
    return NextResponse.json({ following: false })
  }

  await prisma.follow.create({ data: { userId, artistId: id } })

  // Only on a new follow, not unfollow - nobody needs a push for someone
  // quietly un-following them.
  const follower = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, displayName: true } })
  notifyAfterResponse(
    () =>
      sendPushToUser(artist.userId, {
        title: 'New follower',
        body: `${follower?.displayName || follower?.name || 'Someone'} started following you.`,
        url: '/dashboard/artist',
      }),
    'new-follower'
  )

  return NextResponse.json({ following: true })
}
