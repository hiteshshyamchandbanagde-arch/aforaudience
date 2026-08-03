import prisma from '@/lib/prisma'
import { buildDirectionsUrl } from '@/lib/maps-url'
import VenueDetailClient, { VenueDetailData } from './VenueDetailClient'

// See src/app/venues/page.tsx for why this is needed.
export const dynamic = 'force-dynamic'

interface SeatSection {
  id: string
  name: string
  seats: number
  price: number
}

async function getVenue(id: string) {
  try {
    return await prisma.venue.findUnique({ where: { id } })
  } catch (err) {
    console.error('Failed to fetch venue:', err)
    return null
  }
}

export default async function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const venue = await getVenue(id)

  if (!venue || !venue.isApproved) {
    return <VenueDetailClient venue={null} />
  }

  const sections = (venue.seatMap as { sections?: SeatSection[] } | null)?.sections || []

  // Plain, JSON-serializable subset only - keeps the server/client prop
  // boundary clean (no raw Prisma Date fields etc. crossing it).
  const venueData: VenueDetailData = {
    id: venue.id,
    name: venue.name,
    address: venue.address,
    city: venue.city,
    state: venue.state,
    capacity: venue.capacity,
    facilities: venue.facilities,
    sections,
    directionsUrl: buildDirectionsUrl(venue),
  }

  return <VenueDetailClient venue={venueData} />
}
