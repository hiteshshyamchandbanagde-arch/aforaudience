import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isValidMapsUrl } from '@/lib/maps-url'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const venue = await prisma.venue.findUnique({
      where: { id },
      include: { owner: { include: { user: { select: { isSuspended: true } } } } },
    })
    // H3 - same suspension gate as the public listing (GET /api/venues).
    if (!venue || venue.owner.user.isSuspended) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(venue)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch venue' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const venue = await prisma.venue.findUnique({
      where: { id }
    })

    if (!venue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }

    // Check if user is the owner or an admin
    if (user.role !== 'ADMIN') {
      const venueOwner = await prisma.venueOwner.findUnique({
        where: { id: venue.ownerId }
      })

      if (!venueOwner || venueOwner.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (!venueOwner.isApproved) {
        return NextResponse.json({ error: 'Your Venue Owner account is still pending approval' }, { status: 403 })
      }
    }

    const body = await req.json()
    const { name, address, city, state, country, lat, lng, capacity, acousticRating, facilities, seatMap, publish, mapsUrl } = body

    if (mapsUrl !== undefined && mapsUrl && mapsUrl.trim() && !isValidMapsUrl(mapsUrl)) {
      return NextResponse.json({ error: 'Please paste a real Google Maps link (e.g. from the Share button on Google Maps).' }, { status: 400 })
    }

    const sections = Array.isArray(seatMap?.sections) ? seatMap.sections : undefined
    const seatMapCapacity = sections
      ? sections.reduce((sum: number, s: any) => sum + (Number(s.seats) || 0), 0)
      : undefined

    // Publish gate for NUMBERED venues (design.md §9.1/§9.5 - Hitesh's
    // settled call: strict, every zone priced, every level declared).
    // Was seatCount > 0 only, which let a venue with real seats but zero
    // zone pricing through - confirmed live (Feedback, 25 Jul): a venue
    // published with 4 seats, no zones priced, and an incomplete level.
    // An organiser prices events off VenueZonePrice.suggestedPrice as the
    // prefill (design.md §9.4 PR #149/#151), so every distinct
    // (level, zone) pair that actually has seats needs a real priced row -
    // not just seats existing, and not just a VenueZonePrice row existing
    // with a null price.
    if (publish === true && venue.seatingMode === 'NUMBERED') {
      const seats = await prisma.seat.findMany({
        where: { venueId: id },
        select: { level: true, tierLabel: true },
        distinct: ['level', 'tierLabel'],
      })
      if (seats.length === 0) {
        return NextResponse.json(
          { error: 'Build your seat map before publishing - organisers price events off it, so it needs to be real first. Save as draft, then publish once seats are saved.' },
          { status: 400 }
        )
      }

      const zonePrices = await prisma.venueZonePrice.findMany({
        where: { venueId: id },
        select: { level: true, zoneName: true, suggestedPrice: true },
      })
      const pricedKeys = new Set(
        zonePrices
          .filter((z: { suggestedPrice: number | null }) => typeof z.suggestedPrice === 'number' && z.suggestedPrice > 0)
          .map((z: { level: string; zoneName: string }) => `${z.level}::${z.zoneName}`)
      )
      const missing = seats.filter((s: { level: string; tierLabel: string }) => !pricedKeys.has(`${s.level}::${s.tierLabel}`))

      if (missing.length > 0) {
        // Group by level so an owner with multiple levels can see at a
        // glance whether the gap is "one zone on one level" or "an
        // entire level never got priced."
        const byLevel = new Map<string, string[]>()
        for (const m of missing) {
          const levelLabel = m.level ? m.level : 'Ground'
          if (!byLevel.has(levelLabel)) byLevel.set(levelLabel, [])
          byLevel.get(levelLabel)!.push(m.tierLabel)
        }
        const detail = Array.from(byLevel.entries())
          .map(([level, zones]) => `${level}: ${zones.join(', ')}`)
          .join(' · ')
        return NextResponse.json(
          {
            error: `Every zone needs a price before publishing. Missing: ${detail}. Set prices in the seat map builder, then publish.`,
          },
          { status: 400 }
        )
      }
    }

    const updatedVenue = await prisma.venue.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(address && { address }),
        ...(city && { city }),
        // Explicit null-clear when city is retyped without a new
        // autocomplete pick (CityAutocomplete sends '' in that case,
        // distinct from `undefined` meaning "field wasn't touched").
        ...(state !== undefined && { state: state && String(state).trim() ? String(state).trim() : null }),
        ...(country !== undefined && { country: country && String(country).trim() ? String(country).trim() : null }),
        ...(lat !== undefined && {
          lat: (() => {
            const n = lat !== null && lat !== '' ? Number(lat) : null
            return n !== null && Number.isFinite(n) && n >= -90 && n <= 90 ? n : null
          })(),
        }),
        ...(lng !== undefined && {
          lng: (() => {
            const n = lng !== null && lng !== '' ? Number(lng) : null
            return n !== null && Number.isFinite(n) && n >= -180 && n <= 180 ? n : null
          })(),
        }),
        ...(seatMapCapacity !== undefined ? { capacity: seatMapCapacity } : capacity ? { capacity } : {}),
        ...(acousticRating !== undefined && { acousticRating }),
        ...(mapsUrl !== undefined && { mapsUrl: mapsUrl && mapsUrl.trim() ? mapsUrl.trim() : null }),
        ...(facilities !== undefined && { facilities: Array.isArray(facilities) ? facilities : [] }),
        ...(sections !== undefined && { seatMap: { sections } }),
        ...(publish !== undefined && { isApproved: Boolean(publish) })
      }
    })

    return NextResponse.json(updatedVenue)
  } catch (err) {
    console.error('Error updating venue:', err)
    return NextResponse.json({ error: 'Failed to update venue' }, { status: 500 })
  }
}
