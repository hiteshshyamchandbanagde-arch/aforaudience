import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/organisers - public listing, powers the "Organisers" toggle view
// on /events (session 62, design.md §9.5). Only approved Organisers are
// public - same isApproved gate the rest of the app already uses.
//
// SECURITY FIX (same session, caught via live verification against QA):
// the first version of this route used `include`, which returns every
// column on Organiser - including razorpayAccountId, panNumber, gstin,
// gstRegistered, walletBalance. All of that leaked on a public,
// unauthenticated endpoint. Explicit `select` here, matching the narrow
// projection already used on the detail route
// (src/app/api/organisers/[id]/route.ts) - never widen this back to
// `include` on a public route.
export async function GET() {
  try {
    const organisers = await prisma.organiser.findMany({
      where: { isApproved: true },
      select: {
        id: true,
        orgName: true,
        bio: true,
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
