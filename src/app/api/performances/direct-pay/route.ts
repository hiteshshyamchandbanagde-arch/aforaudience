import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { performanceDirection } from '@/lib/performance-direct-pay'
import { expireDirectPayPerformances } from '@/lib/performance-direct-pay.server'

/**
 * D3 - the caller's direct-payment performances, both sides:
 *   asArtist:    their own slots (PAID: they are paid; BUY_IN: they pay)
 *   asOrganiser: slots on their events (PAID: they pay; BUY_IN: they are paid)
 * Each row carries `payer`/`payee` and the payee block (name, UPI ID, QR,
 * amount). Optional `?eventId=` narrows the organiser side to one lineup.
 * Expired waiting steps are expired lazily first.
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string } | undefined)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const eventId = new URL(req.url).searchParams.get('eventId') || undefined
    const [artist, organiser] = await Promise.all([
      prisma.artist.findUnique({ where: { userId }, select: { id: true } }),
      prisma.organiser.findUnique({ where: { userId }, select: { id: true } }),
    ])
    if (!artist && !organiser) return NextResponse.json({ asArtist: [], asOrganiser: [] })

    const artistWhere = artist ? { artistId: artist.id } : null
    const organiserWhere = organiser ? { event: { organiserId: organiser.id, ...(eventId && { id: eventId }) } } : null
    await expireDirectPayPerformances({ OR: [artistWhere, organiserWhere].filter((x) => x !== null) })

    const include = {
      artist: { select: { upiId: true, upiQrUrl: true, user: { select: { name: true } } } },
      event: { select: { id: true, title: true, date: true, startTime: true, organiser: { select: { orgName: true, upiId: true, upiQrUrl: true } } } },
    } as const
    const base = { paymentMethod: 'DIRECT' as const, directPayStatus: { not: null } }
    const [mine, theirs] = await Promise.all([
      artistWhere ? prisma.performance.findMany({ where: { ...base, ...artistWhere }, include, orderBy: { createdAt: 'desc' }, take: 50 }) : [],
      organiserWhere ? prisma.performance.findMany({ where: { ...base, ...organiserWhere }, include, orderBy: { createdAt: 'desc' }, take: 100 }) : [],
    ])

    const shape = (p: (typeof mine)[number]) => {
      const dir = performanceDirection(p)
      const artistName = p.artist.user.name || 'Artist'
      const payeeIsArtist = dir?.payee === 'ARTIST'
      return {
        id: p.id,
        compensationType: p.compensationType,
        amount: dir?.amount ?? 0,
        payer: dir?.payer ?? null,
        payee: dir?.payee ?? null,
        directPayStatus: p.directPayStatus,
        payerReference: p.payerReference,
        expiresAt: p.expiresAt,
        cancelledAt: p.cancelledAt,
        confirmedAt: p.confirmedAt,
        directRefundStatus: p.directRefundStatus,
        cancelledBy: p.cancelledBy,
        refundReceivedAt: p.refundReceivedAt,
        event: { id: p.event.id, title: p.event.title, date: p.event.date, startTime: p.event.startTime },
        artistName,
        orgName: p.event.organiser.orgName,
        payeeBlock: {
          name: payeeIsArtist ? artistName : p.event.organiser.orgName,
          upiId: payeeIsArtist ? p.artist.upiId : p.event.organiser.upiId,
          upiQrUrl: payeeIsArtist ? p.artist.upiQrUrl : p.event.organiser.upiQrUrl,
        },
      }
    }
    return NextResponse.json({ asArtist: mine.map(shape), asOrganiser: theirs.map(shape) })
  } catch (err) {
    console.error('Error listing direct-pay performances:', err)
    return NextResponse.json({ error: 'Failed to load payments' }, { status: 500 })
  }
}
