import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Applies as much of the Organiser's wallet balance as possible toward a
// venue booking's platform fee (per Hitesh, 23 Jul: wallet credit from
// cancelled Buy-in slots should be reusable against future venue booking
// fees). One-directional and capped - never applies more than either the
// available wallet balance or the remaining fee, and never goes negative
// on either side.
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

  const booking = await prisma.venueBooking.findUnique({
    where: { id },
    include: { organiser: true },
  })
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }
  if (user.role !== 'ADMIN' && booking.organiser.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const remainingFee = booking.platformFeeAmount ?? 0
  if (remainingFee <= 0) {
    return NextResponse.json({ error: 'This booking has no remaining platform fee to apply credit to.' }, { status: 400 })
  }
  if (booking.organiser.walletBalance <= 0) {
    return NextResponse.json({ error: 'No wallet balance available.' }, { status: 400 })
  }

  const applied = Math.min(remainingFee, booking.organiser.walletBalance)

  const [updatedBooking] = await prisma.$transaction([
    prisma.venueBooking.update({
      where: { id },
      data: { platformFeeAmount: remainingFee - applied },
    }),
    prisma.organiser.update({
      where: { id: booking.organiserId },
      data: { walletBalance: { decrement: applied } },
    }),
  ])

  return NextResponse.json({ applied, platformFeeAmount: updatedBooking.platformFeeAmount })
}
