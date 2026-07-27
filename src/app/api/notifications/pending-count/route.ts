import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

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
    const [pendingApplications, pendingFlex] = await Promise.all([
      prisma.application.count({ where: { event: { organiserId: organiser.id }, status: 'PENDING' } }),
      prisma.venueBookingRequest.count({ where: { organiserId: organiser.id, status: 'PENDING' } }),
    ])
    return NextResponse.json({ count: pendingApplications + pendingFlex })
  }

  return NextResponse.json({ count: 0 })
}
