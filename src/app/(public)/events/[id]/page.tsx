import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import EventDetailClientPage from './EventDetailClientPage'

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      venue: true,
      lineup: {
        include: {
          artist: { include: { user: true } },
          reviews: {
            include: {
              user: { select: { name: true } },
              reply: { include: { author: { select: { name: true, displayName: true } } } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { slot: 'asc' },
      },
      ticketTiers: true,
    },
  })

  if (!event || event.status !== 'APPROVED') {
    return <EventDetailClientPage event={null} canReview={false} />
  }

  // Client-side half of the review-eligibility gate (server-side half —
  // POST /api/reviews rejecting non-checked-in users — has been in place
  // since the nineteenth amendment). Computed here rather than fetched
  // client-side since this page is already force-dynamic (per-request).
  // Anonymous viewers always get canReview: false, which is correct —
  // we can't verify a check-in without a session, and if they sign in
  // and are actually checked in, reloading the page picks it up.
  const session = await getServerSession(authOptions)
  let canReview = false
  if (session?.user) {
    const checkedInBooking = await prisma.booking.findFirst({
      where: {
        userId: (session.user as any).id,
        eventId: id,
        status: 'CONFIRMED',
        checkedInAt: { not: null },
      },
      select: { id: true },
    })
    canReview = !!checkedInBooking
  }

  return <EventDetailClientPage event={JSON.parse(JSON.stringify(event))} canReview={canReview} />
}

// Same reasoning as venues/page.tsx - no dynamic API is used here otherwise,
// so force per-request rendering instead of a frozen build-time snapshot.
export const dynamic = 'force-dynamic'
