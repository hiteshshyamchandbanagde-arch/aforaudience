import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/venue-owners - public listing, powers the "Owners" toggle view
// on /venues (session 62, design.md §9.5). Only approved Venue Owners are
// public, same isApproved gate the rest of the app already uses.
//
// Uses explicit `select`, not `include` - VenueOwner has no sensitive
// fields today, but matching the fix applied to /api/organisers (same
// session, same root cause) so this route doesn't silently start leaking
// data the moment a sensitive column is ever added to this model.
//
// user.displayName included alongside user.name (session 62 follow-up
// fix): every other user-facing surface in this app reads
// `displayName ?? name` - VenueOwner has no separate business-name field
// like Organiser.orgName, so the raw login username was showing as the
// card title. Caught via live verification, not a report.
export async function GET() {
  try {
    const venueOwners = await prisma.venueOwner.findMany({
      where: { isApproved: true },
      select: {
        id: true,
        bio: true,
        user: { select: { name: true, displayName: true, avatar: true } },
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
