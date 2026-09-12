import prisma from '@/lib/prisma'

// Contribution-moment screen (post-seat-confirm) needs a live "N people
// supporting this show" count. Event.totalSeats/availableSeats are only
// kept accurate on the GA/flat booking path - same NUMBERED-venue live-
// occupancy correction as src/app/(public)/events/[id]/seats/page.tsx
// (see that file's own comment for the full "Jaipur Mic Gala 100" bug
// history this fixes), extracted here so both call sites share one
// definition instead of re-deriving it.
export async function getEventOccupancy(event: {
  id: string
  venueId: string | null
  totalSeats: number
  availableSeats: number
}, seatingMode: 'GENERAL_ADMISSION' | 'NUMBERED' | undefined) {
  if (seatingMode !== 'NUMBERED' || !event.venueId) {
    return { totalSeats: event.totalSeats, availableSeats: event.availableSeats }
  }

  const now = new Date()
  const [seatTotal, heldCount] = await Promise.all([
    prisma.seat.count({ where: { venueId: event.venueId } }),
    prisma.bookingSeat.count({
      where: {
        booking: {
          eventId: event.id,
          OR: [
            { status: 'CONFIRMED' },
            { status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          ],
        },
      },
    }),
  ])
  return { totalSeats: seatTotal, availableSeats: Math.max(0, seatTotal - heldCount) }
}

// First (lowest-slot) confirmed lineup entry is this app's established
// "headliner" convention - same read EventDetailClientPage.tsx uses to
// name a performer (p.artist.user.displayName || p.artist.user.name).
// Falls back to the event's own title when no artist is listed (a DJ
// night/open mic with no fixed lineup, or lineup not yet confirmed) -
// never leaves the contribution card referring to a blank name.
export function resolveArtistName(
  event: { title: string; lineup: { artist: { user: { displayName: string | null; name: string } } }[] }
): string {
  const first = event.lineup[0]
  if (!first) return event.title
  return first.artist.user.displayName || first.artist.user.name
}
