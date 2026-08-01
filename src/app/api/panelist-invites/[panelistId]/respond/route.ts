import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// PATCH /api/panelist-invites/[panelistId]/respond
// body: { accept: boolean }
//
// Accept-to-Appear (§8, session 57) - only the invited user can respond
// to their own invite. Accepting is what flips the panelist to publicly
// visible; presence on the poster/event page *is* the proof of consent,
// nothing else needed. Same shape as CompanionTag's own respond route.
export async function PATCH(req: Request, { params }: { params: Promise<{ panelistId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id
  const { panelistId } = await params

  const body = await req.json().catch(() => ({}))
  if (typeof body.accept !== 'boolean') {
    return NextResponse.json({ error: 'accept (boolean) is required' }, { status: 400 })
  }

  const panelist = await prisma.eventPanelist.findUnique({ where: { id: panelistId } })
  if (!panelist) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }
  if (panelist.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (panelist.status !== 'PENDING') {
    return NextResponse.json({ error: 'This invite has already been responded to' }, { status: 409 })
  }

  const updated = await prisma.eventPanelist.update({
    where: { id: panelistId },
    data: { status: body.accept ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() },
  })

  return NextResponse.json({ panelist: updated })
}
