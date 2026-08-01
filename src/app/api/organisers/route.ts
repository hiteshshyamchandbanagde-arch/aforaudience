import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/organisers - public listing, powers the "Organisers" toggle view
// on /events (session 62, design.md §9.5). Only approved Organisers are
// public - same isApproved gate the rest of the app already uses.
export async function GET() {
  try {
    const organisers = await prisma.organiser.findMany({
      where: { isApproved: true },
      include: {
        user: { select: { name: true, avatar: true } },
        // Only count publicly-visible events, not DRAFT/PENDING_APPROVAL -
        // an organiser with 5 draft events shouldn't look more active than
        // one with 5 real published ones.
        _count: { select: { events: { where: { status: { in: ['APPROVED', 'COMPLETED'] } } } } },
      },
    })
    organisers.sort((a, b) => b._count.events - a._count.events)
    return NextResponse.json(organisers)
  } catch (err) {
    console.error('Error fetching organisers:', err)
    return NextResponse.json({ error: 'Failed to fetch organisers' }, { status: 500 })
  }
}
