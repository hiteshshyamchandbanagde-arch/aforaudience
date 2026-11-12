import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { expireDirectPayBookings } from '@/lib/venue-direct-pay.server'

/**
 * D2 - the caller's direct-payment venue bookings, both sides:
 *   asOrganiser: bookings they need to pay (with the payee block: owner
 *                name, UPI ID, amount)
 *   asOwner:     bookings on their venues waiting on / showing payment
 * Expired waiting steps are expired lazily first, so nobody sees a stale
 * "awaiting payment".
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string } | undefined)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [organiser, owner] = await Promise.all([
      prisma.organiser.findUnique({ where: { userId }, select: { id: true } }),
      prisma.venueOwner.findUnique({ where: { userId }, select: { id: true } }),
    ])
    if (!organiser && !owner) return NextResponse.json({ asOrganiser: [], asOwner: [] })

    const scopes = [
      ...(organiser ? [{ organiserId: organiser.id }] : []),
      ...(owner ? [{ venue: { ownerId: owner.id } }] : []),
    ]
    await expireDirectPayBookings({ OR: scopes })

    const select = {
      id: true,
      status: true,
      amount: true,
      fromDate: true,
      toDate: true,
      eventId: true,
      paymentMethod: true,
      directPayStatus: true,
      paidMarkedAt: true,
      payerReference: true,
      confirmedAt: true,
      expiresAt: true,
      directRefundStatus: true,
      cancelledBy: true,
      cancelledAt: true,
      refundReceivedAt: true,
      platformFeeAmount: true,
      createdAt: true,
      venue: {
        select: {
          id: true,
          name: true,
          city: true,
          owner: { select: { upiId: true, upiQrUrl: true, user: { select: { name: true } } } },
        },
      },
      organiser: { select: { orgName: true } },
    } as const

    const [asOrganiser, asOwner] = await Promise.all([
      organiser
        ? prisma.venueBooking.findMany({
            where: { organiserId: organiser.id, directPayStatus: { not: null } },
            select,
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        : [],
      owner
        ? prisma.venueBooking.findMany({
            where: { venue: { ownerId: owner.id }, directPayStatus: { not: null } },
            select,
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        : [],
    ])

    const shape = (b: (typeof asOwner)[number]) => ({
      ...b,
      payee: {
        name: b.venue.owner.user.name || b.venue.name,
        venueName: b.venue.name,
        upiId: b.venue.owner.upiId,
        upiQrUrl: b.venue.owner.upiQrUrl,
      },
    })
    return NextResponse.json({ asOrganiser: asOrganiser.map(shape), asOwner: asOwner.map(shape) })
  } catch (err) {
    console.error('Error listing direct-pay venue bookings:', err)
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 })
  }
}
