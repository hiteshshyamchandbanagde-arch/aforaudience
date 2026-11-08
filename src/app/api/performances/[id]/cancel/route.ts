import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'
import { promoteNextWaitlisted } from '@/lib/performance-direct-pay.server'
import { isWaitingDirectPay } from '@/lib/venue-direct-pay'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

// Combines Event.date + startTime into a real instant, same pattern
// already used in POST /api/events for backdated-event validation.
function eventStartInstant(date: Date, startTime: string): Date {
  const [h, m] = startTime.split(':').map(Number)
  const start = new Date(date)
  start.setHours(h, m, 0, 0)
  return start
}

// Artist self-cancellation. Consequence rules per Hitesh (23 Jul):
// - Cancelling within 24h of the event is blocked outright, no exception.
// - A cancelled Buy-in slot defaults to REFUNDED (bookkeeping only - no
//   real Buy-in payment collection exists yet, see EPIC C) - "no one
//   will be punished" for cancelling. Never WALLET_CREDITED by default;
//   that's an Organiser-only override afterward (separate endpoint).
// - The freed slot auto-promotes the oldest WAITLISTED application, FCFS
//   - this is what actually closes the loop from the waitlist feature.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    include: { artist: true, event: { include: { organiser: true } } },
  })
  if (!performance) {
    return NextResponse.json({ error: 'Performance not found' }, { status: 404 })
  }
  if (performance.artist.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (performance.cancelledAt) {
    return NextResponse.json({ error: 'Already cancelled' }, { status: 400 })
  }

  const eventStart = eventStartInstant(performance.event.date, performance.event.startTime)
  if (eventStart.getTime() - Date.now() < TWENTY_FOUR_HOURS_MS) {
    return NextResponse.json(
      { error: 'Cancellations must be made at least 24 hours before the event.' },
      { status: 400 }
    )
  }

  // D3 - a direct-pay slot still waiting on payment: nothing was collected,
  // so no buy-in refund to record; the payment step ends as CANCELLED.
  const directWaiting = isWaitingDirectPay(performance.directPayStatus)
  const isBuyIn = performance.compensationType === 'BUY_IN' && !!performance.buyInAmount && !directWaiting

  const cancelled = await prisma.performance.update({
    where: { id },
    data: {
      cancelledAt: new Date(),
      ...(isBuyIn && { buyInRefundStatus: 'REFUNDED' }),
      ...(directWaiting && { directPayStatus: 'CANCELLED' }),
    },
  })

  // Auto-promote the oldest waitlisted application for this event, if
  // any - the slot just freed up. Shared with the D3 direct-pay
  // cancel/expiry so every slot release behaves the same.
  const nextWaitlisted = await promoteNextWaitlisted(performance.event)

  notifyAfterResponse(async () => {
    await sendPushToUser(performance.event.organiser.userId, {
      title: 'Artist cancelled',
      body: `${nextWaitlisted ? 'A spot was filled from the waitlist after a' : 'An artist'} cancellation at "${performance.event.title}".`,
      url: `/dashboard/organiser/events/${performance.eventId}`,
    })
  }, 'performance-cancelled-organiser')

  return NextResponse.json(cancelled)
}
