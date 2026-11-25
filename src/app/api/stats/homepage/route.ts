import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/stats/homepage
//
// Powers the "2,400+ Artists / 840+ Events Monthly / 120+ Cities" stat
// row on the homepage hero (Tonight Near You card). Those were static
// placeholder numbers from the original design mock - flagged twice in
// Feedback (GEN-2608-004, FEAT-2607-059) as fake data that needed to
// become real counts. Same visibility rules as the rest of the public
// site: APPROVED events only, non-suspended organisers only, verified
// artists only - this should never show a number larger than what a
// visitor could actually go verify by browsing the platform.
//
// Cities counts distinct venue cities that have an APPROVED event, not
// every city with a registered venue - a venue that signed up but has
// never hosted anything shouldn't inflate the platform's footprint.

export async function GET() {
  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const [artists, eventsThisMonth, cityRows] = await Promise.all([
      prisma.user.count({
        where: { role: 'ARTIST', isVerified: true, isSuspended: false },
      }),
      prisma.event.count({
        where: {
          status: 'APPROVED',
          date: { gte: monthStart, lt: monthEnd },
          organiser: { user: { isSuspended: false } },
        },
      }),
      prisma.event.findMany({
        where: {
          status: 'APPROVED',
          organiser: { user: { isSuspended: false } },
          venueId: { not: null },
        },
        select: { venue: { select: { city: true } } },
        distinct: ['venueId'],
      }),
    ])

    const cities = new Set(cityRows.map((r: { venue: { city: string | null } | null }) => r.venue?.city).filter(Boolean)).size

    return NextResponse.json({ artists, eventsThisMonth, cities })
  } catch (err) {
    console.error('GET /api/stats/homepage error', err)
    return NextResponse.json({ artists: null, eventsThisMonth: null, cities: null }, { status: 200 })
  }
}
