import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'
import { getPaidBookingsEnabled, launchWaveBlock } from '@/lib/platform-settings'
import { performanceNeedsW4 } from '@/lib/launch-waves'
import { performanceDirectPayCreateData } from '@/lib/performance-direct-pay'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const application = await prisma.application.findUnique({ where: { id }, include: { event: true, artist: true } })
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN') {
      const organiser = await prisma.organiser.findUnique({ where: { id: application.event.organiserId } })
      if (!organiser || organiser.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (!organiser.isApproved) {
        return NextResponse.json({ error: 'Your Organiser account is still pending approval' }, { status: 403 })
      }
    }

    const { status, compensationType, feeAmount, buyInAmount, paymentMethod } = await req.json()
    // S1b-a - W4 gate: approving books a lineup slot on these terms (the
    // explicit override, else the event default - same resolution as
    // below). A PAID / BUY_IN slot is refused while W4 is closed, before
    // anything is written. FREE approvals and REJECTED/PENDING go ahead.
    const w4CompType = ['PAID', 'FREE', 'BUY_IN'].includes(compensationType)
      ? compensationType
      : application.event.defaultCompensationType
    const w4 = status === 'APPROVED' && performanceNeedsW4(w4CompType) ? await launchWaveBlock('W4', user.role) : null
    if (w4) return NextResponse.json(w4.body, { status: w4.status })
    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    if (status === 'APPROVED' && application.event.maxPerformers !== null) {
      // cancelledAt: null - same reasoning as POST /api/applications: a
      // cancelled slot must not count against capacity, or the lineup
      // reads as permanently full after the first cancellation even
      // once the waitlist has already backfilled the real open spot.
      const filledSlots = await prisma.performance.count({ where: { eventId: application.eventId, cancelledAt: null } })
      if (filledSlots >= application.event.maxPerformers) {
        return NextResponse.json({ error: 'This event\'s lineup is already full' }, { status: 409 })
      }
    }

    const updated = await prisma.application.update({ where: { id }, data: { status } })

    // Approving an application books the artist a lineup slot for the event.
    if (status === 'APPROVED') {
      const existingPerformance = await prisma.performance.findFirst({
        where: { eventId: application.eventId, artistId: application.artistId },
      })
      if (!existingPerformance) {
        const lineupCount = await prisma.performance.count({ where: { eventId: application.eventId, cancelledAt: null } })
        // Fall back to the event's own declared default terms (set at
        // creation, shown to the Artist before they applied) rather than
        // silently defaulting to FREE when the Organiser doesn't pass an
        // explicit override here - previously an Organiser who declared
        // "Paid ₹500" but forgot to fill in the per-artist override at
        // approval time would have silently downgraded the artist to FREE.
        const validCompType = ['PAID', 'FREE', 'BUY_IN'].includes(compensationType)
          ? compensationType
          : application.event.defaultCompensationType
        const resolvedFeeAmount = compensationType
          ? (validCompType === 'PAID' && feeAmount ? parseFloat(feeAmount) : null)
          : application.event.defaultFeeAmount
        const resolvedBuyInAmount = compensationType
          ? (validCompType === 'BUY_IN' && buyInAmount ? parseFloat(buyInAmount) : null)
          : application.event.defaultBuyInAmount
        // D3 - a PAID/BUY_IN slot agreed while online payments are off (or
        // the organiser chose DIRECT) waits 48 h on a direct payment.
        const direct = performanceDirectPayCreateData(
          { compensationType: validCompType, feeAmount: resolvedFeeAmount, buyInAmount: resolvedBuyInAmount },
          await getPaidBookingsEnabled(),
          paymentMethod
        )
        await prisma.performance.create({
          data: {
            ...direct,
            eventId: application.eventId,
            artistId: application.artistId,
            slot: lineupCount + 1,
            duration: 10,
            compensationType: validCompType,
            feeAmount: resolvedFeeAmount,
            // §4.5 suggestion #6 - Buy-in charges at approval, which is
            // exactly this moment, not at application time. The actual
            // charge/collection isn't wired up yet (needs a payment
            // integration, EPIC C) - this records the agreed amount so
            // that's ready to plug in without a schema change later.
            buyInAmount: resolvedBuyInAmount,
          },
        })
      }
    }

    // Only APPROVED/REJECTED are real decisions worth notifying about -
    // PENDING is an internal reset (e.g. undoing a rejection), not
    // something the artist needs a push for.
    if (status === 'APPROVED' || status === 'REJECTED') {
      notifyAfterResponse(
        () =>
          sendPushToUser(application.artist.userId, {
            title: status === 'APPROVED' ? "You're in the lineup!" : 'Application update',
            body:
              status === 'APPROVED'
                ? `You've been approved to perform at "${application.event.title}".`
                : `Your application to "${application.event.title}" wasn't approved this time.`,
            url: '/dashboard/artist/events',
          }),
        'application-decision'
      )
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Error updating application:', err)
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
  }
}
