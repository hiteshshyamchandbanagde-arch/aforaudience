import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Organiser-only override: keeps a cancelled Buy-in artist's amount as
// wallet credit instead of the default refund. Deliberately one-directional
// - only ever REFUNDED -> WALLET_CREDITED, never the reverse via this
// endpoint, and never triggerable by the artist. This is the Organiser's
// own bookkeeping choice over their own bucket, not something imposed on
// the artist (see POST /api/performances/[id]/cancel for the refund
// default and the reasoning).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const performance = await prisma.performance.findUnique({
    where: { id },
    include: { event: { include: { organiser: true } } },
  })
  if (!performance) {
    return NextResponse.json({ error: 'Performance not found' }, { status: 404 })
  }

  if (user.role !== 'ADMIN' && performance.event.organiser.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!performance.cancelledAt || performance.buyInRefundStatus !== 'REFUNDED') {
    return NextResponse.json(
      { error: 'This is only available for a cancelled Buy-in slot currently marked as refunded.' },
      { status: 400 }
    )
  }

  await prisma.$transaction([
    prisma.performance.update({ where: { id }, data: { buyInRefundStatus: 'WALLET_CREDITED' } }),
    prisma.organiser.update({
      where: { id: performance.event.organiserId },
      data: { walletBalance: { increment: performance.buyInAmount || 0 } },
    }),
  ])

  return NextResponse.json({ buyInRefundStatus: 'WALLET_CREDITED' })
}
