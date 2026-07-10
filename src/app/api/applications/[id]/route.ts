import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

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

    const application = await prisma.application.findUnique({ where: { id }, include: { event: true } })
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

    const { status, compensationType, feeAmount, buyInAmount } = await req.json()
    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    if (status === 'APPROVED' && application.event.maxPerformers !== null) {
      const filledSlots = await prisma.performance.count({ where: { eventId: application.eventId } })
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
        const lineupCount = await prisma.performance.count({ where: { eventId: application.eventId } })
        const validCompType = ['PAID', 'FREE', 'BUY_IN'].includes(compensationType) ? compensationType : 'FREE'
        await prisma.performance.create({
          data: {
            eventId: application.eventId,
            artistId: application.artistId,
            slot: lineupCount + 1,
            duration: 10,
            compensationType: validCompType,
            feeAmount: validCompType === 'PAID' && feeAmount ? parseFloat(feeAmount) : null,
            // §4.5 suggestion #6 - Buy-in charges at approval, which is
            // exactly this moment, not at application time. The actual
            // charge/collection isn't wired up yet (needs a payment
            // integration, EPIC C) - this records the agreed amount so
            // that's ready to plug in without a schema change later.
            buyInAmount: validCompType === 'BUY_IN' && buyInAmount ? parseFloat(buyInAmount) : null,
          },
        })
      }
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Error updating application:', err)
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
  }
}
