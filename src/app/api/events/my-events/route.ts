import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { withListingPrice } from '@/lib/booking-tiers'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user || user.role !== 'ORGANISER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const organiser = await prisma.organiser.findUnique({ where: { userId: user.id } })
    if (!organiser) {
      return NextResponse.json([])
    }

    const events = await prisma.event.findMany({
      where: { organiserId: organiser.id },
      include: { venue: true, applications: true, ticketTiers: { select: { price: true } } },
      orderBy: { createdAt: 'desc' },
    })

    // BUG-2609-079 - a tiered event's card shows "From ₹<cheapest tier>".
    return NextResponse.json(events.map((e) => withListingPrice(e)))
  } catch (err) {
    console.error('Error fetching events:', err)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}
