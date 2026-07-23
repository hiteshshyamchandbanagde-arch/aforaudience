import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getFollowStatus, toggleFollow, setNotifyEnabled } from '@/lib/follow'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  const userId = session?.user ? (session.user as any).id : null
  const result = await getFollowStatus(userId, 'ORGANISER', id)
  return NextResponse.json(result)
}

// Toggle - follows if not already following, unfollows if already following.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organiser = await prisma.organiser.findUnique({ where: { id } })
  if (!organiser) {
    return NextResponse.json({ error: 'Organiser not found' }, { status: 404 })
  }

  const result = await toggleFollow((session.user as any).id, 'ORGANISER', id)
  return NextResponse.json(result)
}

// Bell toggle - mutes/unmutes new-event push without unfollowing.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const notifyEnabled = Boolean(body.notifyEnabled)

  const result = await setNotifyEnabled((session.user as any).id, 'ORGANISER', id, notifyEnabled)
  if (!result) {
    return NextResponse.json({ error: 'Not following this organiser' }, { status: 404 })
  }
  return NextResponse.json(result)
}
