import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { countOpenPendingApplications } from '@/lib/application-status'

// Feedback cms1ibqtf: "we need to required notification icon in dashboard
// to know any request check". Per-page badges already existed (Venue
// Owner's Booking/Flexible Requests buttons, Organiser's per-event
// pending-applications count) - confirmed via code before building this,
// not assumed missing. The actual gap: those only show up once you're
// already on the dashboard home page. This endpoint aggregates the same
// counts into one number the nav bar (SiteNav) can show from anywhere.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ count: 0 })
  }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) return NextResponse.json({ count: 0 })

  if (user.role === 'VENUE_OWNER') {
    const venueOwner = await prisma.venueOwner.findUnique({ where: { userId: user.id } })
    if (!venueOwner) return NextResponse.json({ count: 0 })
    const venues = await prisma.venue.findMany({ where: { ownerId: venueOwner.id }, select: { id: true } })
    const venueIds = venues.map((v: { id: string }) => v.id)
    const [pendingBookings, pendingFlex] = await Promise.all([
      prisma.venueBooking.count({ where: { venueId: { in: venueIds }, status: 'PENDING' } }),
      prisma.venueBookingRequest.count({ where: { venue: { ownerId: venueOwner.id }, status: 'PENDING' } }),
    ])
    return NextResponse.json({ count: pendingBookings + pendingFlex })
  }

  if (user.role === 'ORGANISER') {
    const organiser = await prisma.organiser.findUnique({ where: { userId: user.id } })
    if (!organiser) return NextResponse.json({ count: 0 })
    // BUG-2610-022 - an application for an event that has already happened
    // can no longer be decided, so it is not waiting on the organiser. The
    // stored status stays PENDING (no migration); the event date decides.
    // The database narrows to events dated from two days ago on; the exact
    // start instant (date + startTime, India time) is checked here.
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    const [pendingApplications, pendingFlex] = await Promise.all([
      prisma.application.findMany({
        where: { event: { organiserId: organiser.id, date: { gte: recent } }, status: 'PENDING' },
        select: { status: true, event: { select: { date: true, startTime: true } } },
      }),
      prisma.venueBookingRequest.count({ where: { organiserId: organiser.id, status: 'PENDING' } }),
    ])
    return NextResponse.json({ count: countOpenPendingApplications(pendingApplications) + pendingFlex })
  }

  return NextResponse.json({ count: 0 })
}
