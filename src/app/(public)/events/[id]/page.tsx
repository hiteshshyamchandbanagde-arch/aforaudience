import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import EventDetailClientPage from './EventDetailClientPage'
import { computeHypeScore } from '@/lib/hype-score'

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
      // Accept-to-Appear (§8, session 57) - only ACCEPTED entries are ever
      // fetched for the public page at all; PENDING/DECLINED simply don't
      // exist as far as this query is concerned. `user` joined so display
      // reads the account's own current displayName/avatar, not whatever
      // organiser-typed `name` sits on the row from invite time.
      panelists: {
        where: { status: 'ACCEPTED' },
        orderBy: { order: 'asc' },
        include: { user: { select: { name: true, displayName: true, avatar: true } } },
      },
      celebrities: {
        where: { status: 'ACCEPTED' },
        orderBy: { order: 'asc' },
        include: { user: { select: { name: true, displayName: true, avatar: true } } },
      },
    },
  })

  if (!event || event.status !== 'APPROVED') {
    return <EventDetailClientPage event={null} canReview={false} />
  }

  // Accept-to-Appear (§8) - public display always reads the linked
  // account's own name/photo, never the organiser-typed draft label from
  // invite time (see docs/artist-reputation-system-design.md §8).
  type PanelistRow = { id: string; name: string; bio: string | null; photoUrl: string | null; user: { name: string; displayName: string | null; avatar: string | null } | null }
  type CelebrityRow = { id: string; name: string; photoUrl: string | null; user: { name: string; displayName: string | null; avatar: string | null } | null }

  const panelistsForClient = (event.panelists as PanelistRow[]).map((p) => ({
    id: p.id,
    name: p.user?.displayName || p.user?.name || p.name,
    bio: p.bio,
    photoUrl: p.user?.avatar || p.photoUrl,
  }))
  const celebritiesForClient = (event.celebrities as CelebrityRow[]).map((c) => ({
    id: c.id,
    name: c.user?.displayName || c.user?.name || c.name,
    photoUrl: c.user?.avatar || c.photoUrl,
  }))

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
  // the client only renders the badge when it gets a number. Shared logic
  // now lives in src/lib/hype-score.ts (session 56) - also reused by the
  // admin artist roster.
  const lineupWithHype = event.lineup.map((p: { reviews: { rating: number | null }[] }) => ({ ...p, hypeScore: computeHypeScore(event, p.reviews) }))
  const eventForClient = {
    ...event,
    lineup: lineupWithHype,
    totalSeats: displayTotalSeats,
    availableSeats: displayAvailableSeats,
    panelists: panelistsForClient,
    celebrities: celebritiesForClient,
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

  return <EventDetailClientPage event={JSON.parse(JSON.stringify(eventForClient))} canReview={canReview} />
}

// Same reasoning as venues/page.tsx - no dynamic API is used here otherwise,
// so force per-request rendering instead of a frozen build-time snapshot.
export const dynamic = 'force-dynamic'
