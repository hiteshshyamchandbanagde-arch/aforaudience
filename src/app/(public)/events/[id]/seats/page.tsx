import prisma from '@/lib/prisma'
import SeatSelectionClientPage from './SeatSelectionClientPage'

// GEN-2609-004 (Mobile Redesign Phase 2) - the seat/ticket-tier picker,
// relocated out of EventDetailClientPage.tsx into its own real,
// deep-linkable route (was embedded inline before this phase). Lean
// query - only what the booking panel itself needs, not the full
// lineup/reviews/panelists/celebrities EventDetailPage fetches - see that
// file's own query for the full shape if this one is ever missing a field.
export default async function SeatSelectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const event = await prisma.event.findUnique({
    where: { id },
    include: { venue: true, ticketTiers: true },
  })

  if (!event || !['APPROVED', 'COMPLETED'].includes(event.status)) {
    return <SeatSelectionClientPage event={null} />
  }

  // Same NUMBERED-venue live-occupancy correction as EventDetailPage
  // (Event.totalSeats/availableSeats are only kept accurate on the
  // GA/flat booking path - see that file's own comment for the full
  // "Jaipur Mic Gala 100" bug history this fixes).
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

  const eventForClient = {
    ...event,
    totalSeats: displayTotalSeats,
    availableSeats: displayAvailableSeats,
  }

  return <SeatSelectionClientPage event={JSON.parse(JSON.stringify(eventForClient))} />
}

// Same reasoning as events/[id]/page.tsx - seat availability must never be
// served from a frozen build-time snapshot.
export const dynamic = 'force-dynamic'
