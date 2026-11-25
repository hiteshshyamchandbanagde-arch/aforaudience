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

  // walletBalance: { gte: applied } guards against a concurrent duplicate
  // request (double-click, two tabs) both reading the same starting
  // balance before either commits - only one can actually spend it, the
  // other's updateMany affects 0 rows instead of decrementing twice.
  const orgUpdate = await prisma.organiser.updateMany({
    where: { id: booking.organiserId, walletBalance: { gte: applied } },
    data: { walletBalance: { decrement: applied } },
  })
  if (orgUpdate.count === 0) {
    return NextResponse.json({ error: 'Wallet balance changed - please try again.' }, { status: 409 })
  }

  const updatedBooking = await prisma.venueBooking.update({
    where: { id },
    data: { platformFeeAmount: remainingFee - applied },
  })

  return NextResponse.json({ applied, platformFeeAmount: updatedBooking.platformFeeAmount })
}
