import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// §9.4 twenty-fourth amendment - seat-map builder.
//
// GET is public (same trust level as GET /api/venues/[id] - browse-first,
// no auth needed to see a venue's layout). Used by both the Venue Owner
// builder (to load existing state) and the future audience seat-picker.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const venue = await prisma.venue.findUnique({
      where: { id },
      select: {
        seatingMode: true,
        seatMapFrozen: true,
        seats: {
          select: { id: true, tierLabel: true, level: true, row: true, number: true, x: true, y: true },
        },
        zonePrices: {
          select: { level: true, zoneName: true, suggestedPrice: true },
        },
        markers: {
          select: { id: true, type: true, level: true, x: true, y: true, label: true, distanceMeters: true },
        },
        underlays: {
          select: { level: true, imageUrl: true, opacity: true },
        },
      },
    })
    if (!venue) return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    return NextResponse.json(venue)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch seat map' }, { status: 500 })
  }
}

// PUT replaces the venue's entire seat layout in one shot - the builder
// sends its full canvas state (add/move/delete are all local edits until
// Save). Simpler and safer than diffing individual seat CRUD against a
// canvas that's being freely dragged around client-side, and layouts are
// small enough (low hundreds of seats) that a full replace is cheap.
//
// Deliberately does NOT touch Booking/BookingSeat - flipping seatingMode
// or editing the layout after seats have live holds/bookings against them
// is a real business question (§9.5-adjacent), not something to silently
// paper over here. For now: allowed, same as editing any other venue
// field: Venue Owner's own risk pre-launch. Revisit if this becomes a
// real gap once NUMBERED venues have live bookings.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const venue = await prisma.venue.findUnique({ where: { id } })
    if (!venue) return NextResponse.json({ error: 'Venue not found' }, { status: 404 })

    if (user.role !== 'ADMIN') {
      const venueOwner = await prisma.venueOwner.findUnique({ where: { id: venue.ownerId } })
      if (!venueOwner || venueOwner.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (!venueOwner.isApproved) {
        return NextResponse.json({ error: 'Your Venue Owner account is still pending approval' }, { status: 403 })
      }
    }

    // §9.4 Freeze (session 48) - a frozen map is finalized; owner must
    // explicitly Unfreeze (PATCH below) before any further seat/price
    // write goes through. Checked before parsing seats so a stale/large
    // payload can't slip through on a frozen venue.
    if (venue.seatMapFrozen) {
      return NextResponse.json(
        { error: 'This seat map is frozen. Unfreeze it first to make changes.' },
        { status: 409 }
      )
    }

    const body = await req.json()
    const { seatingMode, seats, zonePrices, markers } = body

    if (seatingMode !== 'GENERAL_ADMISSION' && seatingMode !== 'NUMBERED') {
      return NextResponse.json({ error: 'Invalid seatingMode' }, { status: 400 })
    }
    if (!Array.isArray(seats)) {
      return NextResponse.json({ error: 'seats must be an array' }, { status: 400 })
    }
    if (zonePrices !== undefined && !Array.isArray(zonePrices)) {
      return NextResponse.json({ error: 'zonePrices must be an array' }, { status: 400 })
    }
    if (markers !== undefined && !Array.isArray(markers)) {
      return NextResponse.json({ error: 'markers must be an array' }, { status: 400 })
    }
    if (seats.length > 5000) {
      return NextResponse.json({ error: 'Too many seats (max 5000)' }, { status: 400 })
    }
    if (Array.isArray(markers) && markers.length > 200) {
      return NextResponse.json({ error: 'Too many markers (max 200)' }, { status: 400 })
    }

    // Validate + normalize each seat. Same "clamp at the point of state
    // update" reasoning as SeatSectionEditor (PR #100 lesson) - don't
    // trust client-side clamping alone.
    const seenKeys = new Set<string>()
    for (const s of seats) {
      if (
        typeof s.tierLabel !== 'string' || !s.tierLabel.trim() ||
        typeof s.row !== 'string' || !s.row.trim() ||
        typeof s.number !== 'string' || !s.number.trim() ||
        typeof s.x !== 'number' || !Number.isFinite(s.x) ||
        typeof s.y !== 'number' || !Number.isFinite(s.y) ||
        (s.level !== undefined && typeof s.level !== 'string')
      ) {
        return NextResponse.json({ error: 'Malformed seat entry' }, { status: 400 })
      }
      // Level-scoped uniqueness - the same row/number legitimately repeats
      // across different levels (Ground row A vs Balcony row A).
      const key = `${(s.level || '').trim()}::${s.row}::${s.number}`
      if (seenKeys.has(key)) {
        return NextResponse.json({ error: `Duplicate row/number: ${s.row}${s.number}${s.level ? ` (level: ${s.level})` : ''}` }, { status: 400 })
      }
      seenKeys.add(key)
    }

    if (Array.isArray(zonePrices)) {
      for (const z of zonePrices) {
        if (typeof z?.suggestedPrice === 'number' && Number.isFinite(z.suggestedPrice) && z.suggestedPrice < 0) {
          return NextResponse.json({ error: `Zone price can't be negative${z.zoneName ? ` (${z.zoneName})` : ''}. Use 0 for a free zone.` }, { status: 400 })
        }
      }
    }

    const validMarkerTypes = new Set(['GATE', 'FIRE_EXTINGUISHER', 'STAGE_DISTANCE_REF'])
    if (Array.isArray(markers)) {
      for (const m of markers) {
        if (
          typeof m?.type !== 'string' || !validMarkerTypes.has(m.type) ||
          typeof m.x !== 'number' || !Number.isFinite(m.x) ||
          typeof m.y !== 'number' || !Number.isFinite(m.y) ||
          (m.level !== undefined && typeof m.level !== 'string') ||
          (m.label !== undefined && typeof m.label !== 'string') ||
          (m.distanceMeters !== undefined && m.distanceMeters !== null && (typeof m.distanceMeters !== 'number' || !Number.isFinite(m.distanceMeters)))
        ) {
          return NextResponse.json({ error: 'Malformed marker entry' }, { status: 400 })
        }
        if (typeof m.distanceMeters === 'number' && m.distanceMeters < 0) {
          return NextResponse.json({ error: 'Marker distance cannot be negative' }, { status: 400 })
        }
      }
    }

    // §9.2-pattern gap check: same numeric-overflow family as PR #100/#112.
    const clamp = (n: number) => Math.max(-100000, Math.min(100000, n))

    await prisma.$transaction(async (tx: any) => {
      // NUMBERED-mode bookings hold BookingSeat rows FK'd to Seat with
      // onDelete: RESTRICT (not CASCADE) - deliberately, so a full-replace
      // save can never silently orphan a live booking. If any seat with
      // an active hold/booking would be deleted, this delete throws and
      // the whole transaction rolls back rather than half-applying.
      await tx.seat.deleteMany({ where: { venueId: id } })
      if (seats.length > 0) {
        await tx.seat.createMany({
          data: seats.map((s: any) => ({
            venueId: id,
            tierLabel: s.tierLabel.trim().slice(0, 60),
            level: (s.level || '').trim().slice(0, 60),
            row: s.row.trim().slice(0, 10),
            number: s.number.trim().slice(0, 10),
            x: clamp(s.x),
            y: clamp(s.y),
          })),
        })
      }
      // Same full-replace pattern as seats - zonePrices is small (one row
      // per zone, not per seat) and this stays a single atomic operation
      // alongside the seat replace rather than a separate round trip.
      await tx.venueZonePrice.deleteMany({ where: { venueId: id } })
      if (Array.isArray(zonePrices) && zonePrices.length > 0) {
        await tx.venueZonePrice.createMany({
          data: zonePrices
            .filter((z: any) => typeof z.zoneName === 'string' && z.zoneName.trim())
            .map((z: any) => ({
              venueId: id,
              level: (z.level || '').trim().slice(0, 60),
              zoneName: z.zoneName.trim().slice(0, 60),
              suggestedPrice:
                typeof z.suggestedPrice === 'number' && Number.isFinite(z.suggestedPrice) ? clamp(z.suggestedPrice) : null,
            })),
        })
      }
      // Same full-replace pattern - markers are few per venue (low tens),
      // no FK dependents (unlike Seat/BookingSeat), so a plain delete+
      // recreate is safe here with no RESTRICT concerns.
      await tx.venueMarker.deleteMany({ where: { venueId: id } })
      if (Array.isArray(markers) && markers.length > 0) {
        await tx.venueMarker.createMany({
          data: markers.map((m: any) => ({
            venueId: id,
            type: m.type,
            level: (m.level || '').trim().slice(0, 60),
            x: clamp(m.x),
            y: clamp(m.y),
            label: (m.label || '').trim().slice(0, 120),
            distanceMeters:
              typeof m.distanceMeters === 'number' && Number.isFinite(m.distanceMeters) ? Math.min(100000, m.distanceMeters) : null,
          })),
        })
      }

      await tx.venue.update({
        where: { id },
        data: {
          seatingMode,
          // Capacity was only ever a placeholder number entered at
          // creation for NUMBERED venues (no real seats existed yet).
          // Once a real seat map is saved, capacity should reflect it -
          // otherwise listings/search keep showing a stale guess forever.
          ...(seatingMode === 'NUMBERED' ? { capacity: seats.length } : {}),
        },
      })
    })

    return NextResponse.json({ ok: true, seatCount: seats.length, markerCount: Array.isArray(markers) ? markers.length : 0, seatingMode })
  } catch (err: any) {
    // Foreign key violation from the RESTRICT constraint above surfaces
    // here as a Prisma P2003/P2014-family error - give a real message
    // instead of a generic 500, since this is a reachable, meaningful case.
    if (err?.code === 'P2003' || err?.code === 'P2014' || /foreign key/i.test(String(err?.message))) {
      return NextResponse.json(
        { error: 'Cannot remove a seat that has an active hold or booking against it.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Failed to save seat map' }, { status: 500 })
  }
}

// §9.4 Freeze + method persistence (session 48) - dedicated toggle,
// deliberately separate from PUT above. Freezing/unfreezing is an
// explicit, self-contained action ("this map is finalized" / "let me
// edit again"), not a side effect of saving a layout - keeping it out
// of PUT means the freeze state can't be flipped accidentally as a
// byproduct of some other seat-array payload.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const venue = await prisma.venue.findUnique({
      where: { id },
      select: { ownerId: true, seatingMode: true, seatMapFrozen: true, _count: { select: { seats: true } } },
    })
    if (!venue) return NextResponse.json({ error: 'Venue not found' }, { status: 404 })

    if (user.role !== 'ADMIN') {
      const venueOwner = await prisma.venueOwner.findUnique({ where: { id: venue.ownerId } })
      if (!venueOwner || venueOwner.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const body = await req.json()
    if (typeof body?.frozen !== 'boolean') {
      return NextResponse.json({ error: '"frozen" must be a boolean' }, { status: 400 })
    }

    // Freezing an empty map isn't a real "finalized" state - nothing to
    // finalize yet. Unfreezing has no such requirement.
    if (body.frozen && venue.seatingMode === 'NUMBERED' && venue._count.seats === 0) {
      return NextResponse.json({ error: 'Add at least one seat before freezing the map.' }, { status: 400 })
    }

    await prisma.venue.update({ where: { id }, data: { seatMapFrozen: body.frozen } })
    return NextResponse.json({ ok: true, seatMapFrozen: body.frozen })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update freeze state' }, { status: 500 })
  }
}
