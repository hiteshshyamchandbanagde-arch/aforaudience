// D3 - DB side of direct-payment performance fees. Pure rules live in
// performance-direct-pay.ts. The slot release here is the one the artist's
// own cancel (POST /api/performances/[id]/cancel) uses, so a cancelled or
// expired direct-pay slot frees the lineup exactly the same way.
import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'
import { getPaidBookingsEnabled } from '@/lib/platform-settings'
import { performanceDirectPayCreateData } from '@/lib/performance-direct-pay'

/**
 * Promotes the oldest WAITLISTED application for an event into the slot
 * that just freed up (FCFS), on the event's default terms. A PAID/BUY_IN
 * promotion enters the direct-payment step like any other new slot.
 * Returns the promoted application, or null when the waitlist is empty.
 */
export async function promoteNextWaitlisted(event: {
  id: string
  title: string
  defaultCompensationType: 'PAID' | 'FREE' | 'BUY_IN'
  defaultFeeAmount: number | null
  defaultBuyInAmount: number | null
}) {
  const nextWaitlisted = await prisma.application.findFirst({
    where: { eventId: event.id, status: 'WAITLISTED' },
    orderBy: { createdAt: 'asc' },
    include: { artist: true },
  })
  if (!nextWaitlisted) return null

  const lineupCount = await prisma.performance.count({
    where: { eventId: event.id, cancelledAt: null },
  })
  const terms = {
    compensationType: event.defaultCompensationType,
    feeAmount: event.defaultCompensationType === 'PAID' ? event.defaultFeeAmount : null,
    buyInAmount: event.defaultCompensationType === 'BUY_IN' ? event.defaultBuyInAmount : null,
  }
  const direct = performanceDirectPayCreateData(terms, await getPaidBookingsEnabled())
  await prisma.$transaction([
    prisma.application.update({ where: { id: nextWaitlisted.id }, data: { status: 'APPROVED' } }),
    prisma.performance.create({
      data: {
        eventId: event.id,
        artistId: nextWaitlisted.artistId,
        slot: lineupCount + 1,
        duration: 10,
        // Same fallback-to-event-default as a normal approval.
        ...terms,
        ...direct,
      },
    }),
  ])

  notifyAfterResponse(async () => {
    await sendPushToUser(nextWaitlisted.artist.userId, {
      title: "You're in the lineup!",
      body: `A spot opened up at "${event.title}" - you've been promoted from the waitlist.`,
      url: '/dashboard/artist/events',
    })
  }, 'waitlist-promoted')

  return nextWaitlisted
}

/**
 * Expires every waiting (AWAITING_PAYMENT / PAID_MARKED) direct-pay
 * performance whose 48 h window has passed, optionally scoped by `where`.
 * Expired = the slot is released (cancelledAt set, waitlist promoted) with
 * directPayStatus EXPIRED. Shared by the lazy check and the 15-min cron.
 * Returns how many performances expired.
 */
export async function expireDirectPayPerformances(
  where: Prisma.PerformanceWhereInput = {},
  now: Date = new Date()
): Promise<number> {
  const due = await prisma.performance.findMany({
    where: {
      ...where,
      cancelledAt: null,
      directPayStatus: { in: ['AWAITING_PAYMENT', 'PAID_MARKED'] },
      expiresAt: { lt: now },
    },
    select: { id: true, directPayStatus: true },
  })
  let count = 0
  for (const p of due) {
    if (await releaseDirectPaySlot(p.id, p.directPayStatus as 'AWAITING_PAYMENT' | 'PAID_MARKED', 'EXPIRED', now)) count++
  }
  return count
}

/**
 * Ends a waiting direct-pay performance (CANCELLED by a party, or EXPIRED)
 * and releases its lineup slot. Guarded on the step we read, so a race moves
 * it once. Nothing was collected, so no buy-in refund status is recorded.
 * Returns false when the row had already moved on.
 */
export async function releaseDirectPaySlot(
  id: string,
  from: 'AWAITING_PAYMENT' | 'PAID_MARKED',
  to: 'CANCELLED' | 'EXPIRED',
  now: Date = new Date()
): Promise<boolean> {
  const res = await prisma.performance.updateMany({
    where: { id, cancelledAt: null, directPayStatus: from },
    data: { cancelledAt: now, directPayStatus: to },
  })
  if (res.count === 0) return false
  const p = await prisma.performance.findUnique({
    where: { id },
    select: {
      event: {
        select: { id: true, title: true, defaultCompensationType: true, defaultFeeAmount: true, defaultBuyInAmount: true },
      },
    },
  })
  if (p) await promoteNextWaitlisted(p.event)
  return true
}
