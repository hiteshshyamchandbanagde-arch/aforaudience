import prisma from '@/lib/prisma'

// Contribution-moment screen (post-seat-confirm) needs a live "N people
// supporting this show" count - a real seats-taken tally, not a display
// availability number.
//
// Event.availableSeats looks like it should already be this, but it
// isn't: grepping every write site shows it's only ever set once at
// event creation (POST /api/events) and decremented by the unrelated
// "+1 companion" feature (src/lib/plus-one.ts) - POST /api/bookings
// never touches it. Confirmed live (12 Sep) booking a real QA event
// through the actual seat-confirm flow: the contribution card showed
// "0 people supporting" right after a real booking, because this
// helper's first version read that same stale field. Real capacity
// checks in POST /api/bookings instead aggregate live Booking rows
// (CONFIRMED + not-yet-expired PENDING) - same query this mirrors, so
// the count here always matches what capacity checking already treats
// as "taken".
export async function getSupporterCount(event: {
  id: string
  venueId: string | null
}, seatingMode: 'GENERAL_ADMISSION' | 'NUMBERED' | undefined): Promise<number> {
  const now = new Date()

  if (seatingMode === 'NUMBERED' && event.venueId) {
    return prisma.bookingSeat.count({
      where: {
        booking: {
          eventId: event.id,
          OR: [
            { status: 'CONFIRMED' },
            { status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          ],
        },
      },
    })
  }

  // GA/flat bookings store `seats` as a { sectionName: qty } JSON map
  // (empty for NUMBERED bookings, which is why those are counted via
  // bookingSeat rows above instead) - same shape POST /api/bookings'
  // own capacity check sums.
  const bookings = await prisma.booking.findMany({
    where: {
      eventId: event.id,
      OR: [
        { status: 'CONFIRMED' },
        { status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    },
    select: { seats: true },
  })
  return bookings.reduce((sum, b) => {
    const seats = (b.seats as Record<string, number>) || {}
    return sum + Object.values(seats).reduce((s, qty) => s + Number(qty), 0)
  }, 0)
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
