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
        seats: {
          select: { id: true, tierLabel: true, row: true, number: true, x: true, y: true },
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

    const body = await req.json()
    const { seatingMode, seats } = body

    if (seatingMode !== 'GENERAL_ADMISSION' && seatingMode !== 'NUMBERED') {
      return NextResponse.json({ error: 'Invalid seatingMode' }, { status: 400 })
    }
    if (!Array.isArray(seats)) {
      return NextResponse.json({ error: 'seats must be an array' }, { status: 400 })
    }
    if (seats.length > 5000) {
      return NextResponse.json({ error: 'Too many seats (max 5000)' }, { status: 400 })
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
        typeof s.y !== 'number' || !Number.isFinite(s.y)
      ) {
        return NextResponse.json({ error: 'Malformed seat entry' }, { status: 400 })
      }
      const key = `${s.row}::${s.number}`
      if (seenKeys.has(key)) {
        return NextResponse.json({ error: `Duplicate row/number: ${s.row}${s.number}` }, { status: 400 })
      }
      seenKeys.add(key)
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
            row: s.row.trim().slice(0, 10),
            number: s.number.trim().slice(0, 10),
            x: clamp(s.x),
            y: clamp(s.y),
          })),
        })
      }
      await tx.venue.update({ where: { id }, data: { seatingMode } })
    })

    return NextResponse.json({ ok: true, seatCount: seats.length, seatingMode })
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
