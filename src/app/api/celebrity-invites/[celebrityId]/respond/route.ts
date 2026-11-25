import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// PATCH /api/celebrity-invites/[celebrityId]/respond
// body: { accept: boolean }
export async function PATCH(req: Request, { params }: { params: Promise<{ celebrityId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id
  const { celebrityId } = await params

  const body = await req.json().catch(() => ({}))
  if (typeof body.accept !== 'boolean') {
    return NextResponse.json({ error: 'accept (boolean) is required' }, { status: 400 })
  }

  const celebrity = await prisma.celebrity.findUnique({ where: { id: celebrityId } })
  if (!celebrity) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }
  if (celebrity.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (celebrity.status !== 'PENDING') {
    return NextResponse.json({ error: 'This invite has already been responded to' }, { status: 409 })
  }

  const updated = await prisma.celebrity.update({
    where: { id: celebrityId },
    data: { status: body.accept ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() },
  })

  return NextResponse.json({ celebrity: updated })
}
