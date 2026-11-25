import prisma from '@/lib/prisma'

// BUG-2609-020 - server-side replacement for DashboardShell.tsx's old
// client-side useHeldRoles() hook. Direct parallel Prisma queries instead
// of 3 HTTP round-trips to /api/organisers/status,/api/artists/status,
// /api/venue-owners/status (those routes stay - SiteNav.tsx still calls
// them for its own dropdown badges, out of scope here).
export type HeldRoles = { ORGANISER: boolean; ARTIST: boolean; VENUE_OWNER: boolean }

export const EMPTY_HELD_ROLES: HeldRoles = { ORGANISER: false, ARTIST: false, VENUE_OWNER: false }

export async function getHeldRoles(userId: string): Promise<HeldRoles> {
  const [organiser, artist, venueOwner] = await Promise.all([
    prisma.organiser.findUnique({ where: { userId } }),
    prisma.artist.findUnique({ where: { userId } }),
    prisma.venueOwner.findUnique({ where: { userId } }),
  ])
  return {
    ORGANISER: !!organiser,
    ARTIST: !!artist,
    VENUE_OWNER: !!venueOwner,
  }
}
