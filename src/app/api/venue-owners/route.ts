import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/venue-owners - public listing, powers the "Owners" toggle view
// on /venues (session 62, design.md §9.5). Only approved Venue Owners are
// public, same isApproved gate the rest of the app already uses.
export async function GET() {
  try {
    const venueOwners = await prisma.venueOwner.findMany({
      where: { isApproved: true },
      include: {
        user: { select: { name: true, avatar: true } },
        _count: { select: { venues: { where: { isApproved: true } } } },
      },
    })
    venueOwners.sort((a, b) => b._count.venues - a._count.venues)
    return NextResponse.json(venueOwners)
  } catch (err) {
    console.error('Error fetching venue owners:', err)
    return NextResponse.json({ error: 'Failed to fetch venue owners' }, { status: 500 })
  }
}
