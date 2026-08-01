import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import EventDetailClientPage from './EventDetailClientPage'
import { getEventEndDateTime } from '@/lib/eventTime'

// Reputation epic §4 - Hype Score display gate. Score only surfaces once
// the show has been over for HYPE_SCORE_WINDOW_HOURS (early partial
// averages from the first few reviews right after doors-close are noisy
// and not what "Hype Score" should represent) AND there are at least
// HYPE_SCORE_MIN_REVIEWS reviews (same reasoning - a single 5-star from
// a friend shouldn't read as a score). Live-computed on every request
// per the epic's session-53 decision, not cached/batch.
const HYPE_SCORE_WINDOW_HOURS = 2
const HYPE_SCORE_MIN_REVIEWS = 5

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      venue: true,
      organiser: true,
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
      panelists: { orderBy: { order: 'asc' } },
    },
  })

  if (!event || event.status !== 'APPROVED') {
    return <EventDetailClientPage event={null} canReview={false} />
  }

  // `Event.totalSeats`/`Event.availableSeats` are only ever kept accurate
  // on the flat/GA booking path (POST /api/bookings decrements/derives
  // from that field there). For NUMBERED venues, occupancy is tracked
  // per-seat via BookingSeat and was never wired back onto these Event
  // columns — confirmed live (26 Jul, session 33) on "Jaipur Mic Gala
  // 100": 3 CONFIRMED bookings holding 11 real seats, yet
  // Event.availableSeats still read 341/341. The booking route itself
  // is fine (it computes occupancy live inside its transaction) — this
  // was purely a stale-display bug on the audience-facing seat count
  // and Filling Fast/Sold Out badge. Compute the real numbers here for
  // NUMBERED venues, same "held = CONFIRMED or unexpired PENDING" rule
  // already proven correct in src/app/api/bookings/route.ts, instead of
  // touching the shared getAvailabilityStatus()/badge component.
  let displayTotalSeats = event.totalSeats
  let displayAvailableSeats = event.availableSeats
  if (event.venue?.seatingMode === 'NUMBERED') {
    const now = new Date()
    const [seatTotal, heldCount] = await Promise.all([
      prisma.seat.count({ where: { venueId: event.venueId! } }),
      prisma.bookingSeat.count({
        where: {
          booking: {
            eventId: id,
            OR: [
              { status: 'CONFIRMED' },
              { status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
            ],
          },
        },
      }),
    ])
    displayTotalSeats = seatTotal
    displayAvailableSeats = Math.max(0, seatTotal - heldCount)
  }
  // Hype Score - per-performance, live-computed from the same reviews
  // already fetched above (no extra query). Null when not yet eligible;
  // the client only renders the badge when it gets a number.
  const hypeScoreEligibleFrom = new Date(getEventEndDateTime(event).getTime() + HYPE_SCORE_WINDOW_HOURS * 60 * 60 * 1000)
  const hypeScoreEligible = Date.now() >= hypeScoreEligibleFrom.getTime()
  const lineupWithHype = event.lineup.map((p) => {
    const eligibleReviews = p.reviews.filter((r) => r.rating != null)
    const hypeScore =
      hypeScoreEligible && eligibleReviews.length >= HYPE_SCORE_MIN_REVIEWS
        ? Math.round((eligibleReviews.reduce((sum, r) => sum + r.rating, 0) / eligibleReviews.length) * 10) / 10
        : null
    return { ...p, hypeScore }
  })
  const eventForClient = { ...event, lineup: lineupWithHype, totalSeats: displayTotalSeats, availableSeats: displayAvailableSeats }

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

  return <EventDetailClientPage event={JSON.parse(JSON.stringify(eventForClient))} canReview={canReview} />
}

// Same reasoning as venues/page.tsx - no dynamic API is used here otherwise,
// so force per-request rendering instead of a frozen build-time snapshot.
export const dynamic = 'force-dynamic'
