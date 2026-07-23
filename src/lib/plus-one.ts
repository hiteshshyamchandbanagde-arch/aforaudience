import prisma from '@/lib/prisma'
import { after } from 'next/server'
import { deliverTicket } from '@/lib/ticket-delivery'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'

export async function getPlusOneStatus(userId: string | null, performanceId: string) {
  const performance = await prisma.performance.findUnique({
    where: { id: performanceId },
    include: { event: { select: { plusOnesRequired: true } } },
  })
  if (!performance) return null

  const confirmedCount = await prisma.plusOne.count({ where: { performanceId } })
  const alreadyConfirmed = userId
    ? !!(await prisma.plusOne.findUnique({ where: { userId_performanceId: { userId, performanceId } } }))
    : false

  return {
    required: performance.event.plusOnesRequired,
    confirmedCount,
    fulfilled: confirmedCount >= performance.event.plusOnesRequired,
    alreadyConfirmed,
  }
}

// Confirms userId as a +1 for the given Performance. Reuses an existing
// CONFIRMED booking for the same event if the user has one (no duplicate
// seat consumed, no duplicate ticket) - otherwise issues a real ₹0 comp
// booking through the same check-in/QR flow as any paid ticket, since a
// pledge with nothing scannable at the door doesn't solve the artist's
// actual problem. Capped at Event.plusOnesRequired for that Performance -
// best-effort under concurrent confirms (a rare race could let one extra
// through, which is harmless), but Event.availableSeats itself is
// decremented atomically so a new comp booking can never oversell a seat.
export async function confirmPlusOne(userId: string, performanceId: string) {
  const performance = await prisma.performance.findUnique({
    where: { id: performanceId },
    include: { event: true, artist: { select: { userId: true } } },
  })
  if (!performance) return { error: 'Performance not found', status: 404 }
  if (performance.event.plusOnesRequired === 0) {
    return { error: 'This event does not require a +1', status: 400 }
  }

  const existing = await prisma.plusOne.findUnique({
    where: { userId_performanceId: { userId, performanceId } },
  })
  if (existing) return { error: 'Already confirmed', status: 409 }

  const confirmedCount = await prisma.plusOne.count({ where: { performanceId } })
  if (confirmedCount >= performance.event.plusOnesRequired) {
    return { error: 'This artist already has enough support confirmed', status: 409 }
  }

  let booking = await prisma.booking.findFirst({
    where: { userId, eventId: performance.eventId, status: 'CONFIRMED' },
  })

  let isNewBooking = false
  if (!booking) {
    const updatedEvent = await prisma.event.updateMany({
      where: { id: performance.eventId, availableSeats: { gt: 0 } },
      data: { availableSeats: { decrement: 1 } },
    })
    if (updatedEvent.count === 0) {
      return { error: 'This event is sold out', status: 409 }
    }

    booking = await prisma.booking.create({
      data: {
        userId,
        eventId: performance.eventId,
        seats: {},
        subtotalAmount: 0,
        bookingFeeAmount: 0,
        totalAmount: 0,
        status: 'CONFIRMED',
      },
    })
    isNewBooking = true
  }

  await prisma.plusOne.create({
    data: { userId, performanceId, bookingId: booking.id },
  })

  if (isNewBooking) {
    const bookingId = booking.id
    after(() => deliverTicket(bookingId))
  }

  const newCount = confirmedCount + 1
  const supporter = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, displayName: true } })
  const supporterName = supporter?.displayName || supporter?.name || 'Someone'
  const required = performance.event.plusOnesRequired
  const eventTitle = performance.event.title
  const artistUserId = performance.artist.userId

  notifyAfterResponse(async () => {
    await sendPushToUser(artistUserId, {
      title: newCount >= required ? "You're fully supported!" : 'New +1 confirmed',
      body:
        newCount >= required
          ? `${supporterName} confirmed - you've got all ${required} supporter${required === 1 ? '' : 's'} you need for ${eventTitle}.`
          : `${supporterName} confirmed as your +1 for ${eventTitle}. ${newCount}/${required} confirmed.`,
      url: '/dashboard/artist',
    })
  }, 'plus-one-confirmed')

  return {
    result: { confirmedCount: newCount, required, alreadyConfirmed: true, fulfilled: newCount >= required },
  }
}
