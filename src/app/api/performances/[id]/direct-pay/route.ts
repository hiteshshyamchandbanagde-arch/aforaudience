import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'
import { type DirectPayAction, directPayExpiresAt, isDirectPayExpired, normalisePayerReference } from '@/lib/venue-direct-pay'
import {
  performanceActor,
  performanceCancelConfirmedData,
  performanceCancelledPushBody,
  performanceDirection,
  performanceDirectPayTransition,
  performanceRefundTransition,
} from '@/lib/performance-direct-pay'
import {
  cancelConfirmedPerformanceSlot,
  expireDirectPayPerformances,
  releaseDirectPaySlot,
} from '@/lib/performance-direct-pay.server'
import { eventStartInstant } from '@/lib/refund-policy'
import { DIRECT_PAY_FULL_REFUND_MIN_DAYS } from '@/lib/direct-pay-terms'

const ACTIONS: readonly DirectPayAction[] = ['markPaid', 'confirmReceived', 'cancel', 'cancelConfirmed', 'refundReceived']

/**
 * D3 - the direct-payment steps of a performance fee (AFA never collects).
 * PAID: organiser pays the artist; BUY_IN: artist pays the organiser.
 *   { action: 'markPaid', reference? }  payer: "I've paid"        -> PAID_MARKED
 *   { action: 'confirmReceived' }       payee: got the money       -> CONFIRMED
 *   { action: 'cancel' }                payer cancels / payee declines, before confirm
 *                                       -> CANCELLED, slot released like an artist cancel
 *   { action: 'cancelConfirmed' }       either party, CONFIRMED and before the event starts
 *                                       -> CANCELLED + refund outcome (DUE / AS_AGREED,
 *                                       15-day term vs the event date), slot released
 *   { action: 'refundReceived' }        payer only (PAID: organiser, BUY_IN: artist):
 *                                       DUE | AS_AGREED -> RECEIVED
 * Expired steps (48 h) are expired lazily here.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string } | undefined)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const action = body?.action as DirectPayAction
    if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    const perf = await prisma.performance.findUnique({
      where: { id },
      include: {
        artist: { select: { userId: true, user: { select: { name: true } } } },
        event: { select: { id: true, title: true, date: true, startTime: true, organiser: { select: { userId: true, isApproved: true, orgName: true } } } },
      },
    })
    if (!perf || !perf.directPayStatus) return NextResponse.json({ error: 'Performance not found' }, { status: 404 })

    const isOrganiser = perf.event.organiser.userId === userId
    const isArtist = perf.artist.userId === userId
    const actor = performanceActor(perf, action, isOrganiser, isArtist)
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (actor === 'ORGANISER' && !perf.event.organiser.isApproved) {
      return NextResponse.json({ error: 'Your Organiser account is still pending approval' }, { status: 403 })
    }

    if (isDirectPayExpired(perf)) {
      await expireDirectPayPerformances({ id: perf.id })
      return NextResponse.json({ error: 'This payment step expired after 48 hours.', code: 'EXPIRED' }, { status: 400 })
    }
    const otherUserId = actor === 'ORGANISER' ? perf.artist.userId : perf.event.organiser.userId
    const otherUrl = actor === 'ORGANISER' ? '/dashboard/artist/events' : `/dashboard/organiser/events/${perf.event.id}/lineup`

    // 12 Nov - the payer confirms a refund of a cancelled confirmed slot arrived.
    if (action === 'refundReceived') {
      const rt = performanceRefundTransition(perf, actor)
      if (!rt.ok) return NextResponse.json({ error: rt.error }, { status: rt.status })
      const rr = await prisma.performance.updateMany({
        where: { id: perf.id, directRefundStatus: perf.directRefundStatus },
        data: { directRefundStatus: 'RECEIVED', refundReceivedAt: new Date() },
      })
      if (rr.count === 0) {
        return NextResponse.json({ error: 'This payment just changed - refresh and try again.' }, { status: 409 })
      }
      if (otherUserId !== userId) {
        const who = actor === 'ARTIST' ? 'The artist' : 'The organiser'
        notifyAfterResponse(
          () =>
            sendPushToUser(otherUserId, {
              title: 'Refund received',
              body: `${who} confirmed they received the refund for "${perf.event.title}".`,
              url: otherUrl,
            }),
          'performance-direct-refundReceived'
        )
      }
      const done = await prisma.performance.findUnique({ where: { id: perf.id } })
      return NextResponse.json(done)
    }

    if (perf.cancelledAt) return NextResponse.json({ error: 'This slot was cancelled.' }, { status: 400 })

    const now = new Date()
    const t = performanceDirectPayTransition(perf, action, actor, {
      eventStart: eventStartInstant(perf.event.date, perf.event.startTime),
      now: now.getTime(),
    })
    if (!t.ok) return NextResponse.json({ error: t.error }, { status: t.status })

    const from = perf.directPayStatus as 'AWAITING_PAYMENT' | 'PAID_MARKED'
    let moved: boolean
    let refundOutcome: 'DUE' | 'AS_AGREED' | null = null
    if (action === 'cancelConfirmed') {
      const data = performanceCancelConfirmedData(perf, perf.event.date, actor, now)
      refundOutcome = data.directRefundStatus
      moved = (await cancelConfirmedPerformanceSlot(perf.id, data)).released
    } else if (t.next === 'CANCELLED') {
      moved = await releaseDirectPaySlot(perf.id, from, 'CANCELLED', now)
    } else {
      const data =
        t.next === 'PAID_MARKED'
          ? {
              // A new waiting step: the payee gets a fresh 48 h to confirm.
              directPayStatus: 'PAID_MARKED' as const,
              paidMarkedAt: now,
              payerReference: normalisePayerReference(body?.reference),
              expiresAt: directPayExpiresAt(now.getTime()),
            }
          : { directPayStatus: 'CONFIRMED' as const, confirmedAt: now }
      // Guarded on the step we read, so a double tap / race moves it once.
      const res = await prisma.performance.updateMany({
        where: { id: perf.id, cancelledAt: null, directPayStatus: from },
        data,
      })
      moved = res.count > 0
    }
    if (!moved) {
      return NextResponse.json({ error: 'This payment just changed - refresh and try again.' }, { status: 409 })
    }

    const dir = performanceDirection(perf)
    const amount = dir ? `₹${dir.amount}` : ''
    const title = perf.event.title
    const push =
      action === 'cancelConfirmed'
        ? {
            title: 'Slot cancelled',
            body: performanceCancelledPushBody(title, dir?.amount ?? 0, refundOutcome, DIRECT_PAY_FULL_REFUND_MIN_DAYS),
            url: otherUrl,
          }
        : t.next === 'PAID_MARKED'
        ? { title: 'Payment marked as sent', body: `Check you received ${amount} for "${title}", then confirm.`, url: otherUrl }
        : t.next === 'CONFIRMED'
          ? { title: 'Payment confirmed', body: `Your payment of ${amount} for "${title}" was confirmed.`, url: otherUrl }
          : { title: 'Slot cancelled', body: `The paid slot at "${title}" was cancelled before payment.`, url: otherUrl }
    if (otherUserId !== userId) {
      notifyAfterResponse(() => sendPushToUser(otherUserId, push), `performance-direct-${action}`)
    }

    const updated = await prisma.performance.findUnique({ where: { id: perf.id } })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('Error updating direct-pay performance:', err)
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
  }
}
