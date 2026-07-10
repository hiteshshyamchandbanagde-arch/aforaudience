import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// F3 - revenue summary + the data a calendar view needs. Only CONFIRMED
// bookings count as real revenue (PENDING is still an open request that
// could be rejected; CANCELLED/REFUNDED obviously don't count).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user || user.role !== 'VENUE_OWNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const venueOwner = await prisma.venueOwner.findUnique({ where: { userId: user.id } })
  if (!venueOwner) {
    return NextResponse.json({ totalRevenue: 0, thisMonthRevenue: 0, confirmedBookings: [] })
  }

  const confirmed = await prisma.venueBooking.findMany({
    where: { venue: { ownerId: venueOwner.id }, status: 'CONFIRMED' },
    include: { venue: { select: { name: true, city: true } }, event: { select: { title: true } } },
    orderBy: { fromDate: 'asc' },
  })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const totalRevenue = confirmed.reduce((sum: number, b: any) => sum + b.amount, 0)
  const thisMonthRevenue = confirmed
    .filter((b: any) => new Date(b.fromDate) >= monthStart && new Date(b.fromDate) < monthEnd)
    .reduce((sum: number, b: any) => sum + b.amount, 0)

  return NextResponse.json({ totalRevenue, thisMonthRevenue, confirmedBookings: confirmed })
}
