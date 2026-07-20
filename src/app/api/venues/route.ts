import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { requireVerifiedPhone } from '@/lib/verification'

export async function GET() {
  try {
    const venues = await prisma.venue.findMany({
      // H3 - same suspension gate as events GET, see comment there.
      where: { isApproved: true, owner: { user: { isSuspended: false } } },
      include: { dayRates: true },
    })
    return NextResponse.json(venues)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch venues' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id }
    })

    if (!user || user.role !== 'VENUE_OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const venueOwner = await prisma.venueOwner.findUnique({
      where: { userId: user.id }
    })

    if (!venueOwner) {
      return NextResponse.json({ error: 'Venue owner profile not found' }, { status: 404 })
    }
    if (!venueOwner.isApproved) {
      return NextResponse.json({ error: 'Your Venue Owner account is still pending approval' }, { status: 403 })
    }
    const verifyError = requireVerifiedPhone(user, 'publishing this venue - organisers plan real bookings around it')
    if (verifyError) return verifyError

    const body = await req.json()
    const {
      name, address, city, capacity, acousticRating, facilities, seatMap, publish,
      rateType, hourlyRate, dailyRate, minDurationHours, dayRates, mapsUrl, seatingMode,
    } = body

    if (!name || !address || !city) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (rateType && !['HOURLY', 'DAILY', 'FLEXIBLE'].includes(rateType)) {
      return NextResponse.json({ error: 'Invalid rate type' }, { status: 400 })
    }
    if (rateType === 'HOURLY' && !(Number(hourlyRate) > 0)) {
      return NextResponse.json({ error: 'Set an hourly rate' }, { status: 400 })
    }
    if (rateType === 'DAILY' && !(Number(dailyRate) > 0)) {
      return NextResponse.json({ error: 'Set a daily rate' }, { status: 400 })
    }

    // §4.5 - per-day rate overrides. Validated the same way as ticket
    // tiers: real enum day, positive amount, only trusted server-side
    // after filtering, never taken from the client as-is.
    const validDayRates = Array.isArray(dayRates)
      ? dayRates.filter((d: any) =>
          ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].includes(d?.dayOfWeek)
          && (Number(d.hourlyRate) > 0 || Number(d.dailyRate) > 0)
        )
      : []

    // If seating sections are provided, total capacity is derived from them.
    // Sane upper bounds - the client's number inputs only had `min`, no
    // `max`, and the form's custom submit handler doesn't run native HTML5
    // validation anyway, so a 13-digit seat count or price was reaching
    // this route unchecked (observed live: 2.2e90 total seats). Bounds
    // are generous on purpose - real venues, not a hard business rule.
    const MAX_SEATS_PER_SECTION = 100_000
    const MAX_PRICE_PER_SEAT = 10_000_000 // ₹1 crore
    const sections = Array.isArray(seatMap?.sections) ? seatMap.sections : []
    for (const s of sections) {
      const seatCount = Number(s?.seats)
      const price = s?.price !== undefined && s?.price !== null && s?.price !== '' ? Number(s.price) : 0
      if (!Number.isFinite(seatCount) || !Number.isInteger(seatCount) || seatCount < 1 || seatCount > MAX_SEATS_PER_SECTION) {
        return NextResponse.json(
          { error: `Each section's seat count must be a whole number between 1 and ${MAX_SEATS_PER_SECTION.toLocaleString('en-IN')}.` },
          { status: 400 }
        )
      }
      if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE_PER_SEAT) {
        return NextResponse.json(
          { error: `Price per seat must be between ₹0 and ₹${MAX_PRICE_PER_SEAT.toLocaleString('en-IN')}.` },
          { status: 400 }
        )
      }
    }
    if (acousticRating !== undefined && acousticRating !== null && acousticRating !== '') {
      const rating = Number(acousticRating)
      if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
        return NextResponse.json({ error: 'Acoustic rating must be between 0 and 5.' }, { status: 400 })
      }
    }
    if (mapsUrl && mapsUrl.trim()) {
      try {
        const parsed = new URL(mapsUrl.trim())
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('bad protocol')
      } catch {
        return NextResponse.json({ error: 'Google Maps link must be a valid URL (starting with https://).' }, { status: 400 })
      }
    }
    const resolvedSeatingMode = seatingMode === 'NUMBERED' ? 'NUMBERED' : 'GENERAL_ADMISSION'
    // NUMBERED venues skip the mandatory section-editor at creation time -
    // the create form sends a plain capacity number instead of seatMap
    // sections. Real per-seat layout is built later via the Seat Map
    // Builder (Venue.seats), not stored in seatMap for this mode.
    const seatMapCapacity = sections.reduce((sum: number, s: any) => sum + (Number(s.seats) || 0), 0)
    const finalCapacity = resolvedSeatingMode === 'GENERAL_ADMISSION' && sections.length > 0 ? seatMapCapacity : parseInt(capacity)

    if (!finalCapacity || finalCapacity < 1) {
      return NextResponse.json(
        { error: 'Add at least one seating section, or provide a seating capacity' },
        { status: 400 }
      )
    }

    // Publish gate: a NUMBERED venue has zero real seats at creation time
    // by construction (the seat map is built afterward in a separate
    // step), so publishing here would always mean "live with nothing an
    // organiser can price against." Force draft; the owner publishes
    // later from Edit once the real seat map exists (PATCH /api/venues/[id]
    // enforces the same check there).
    if (publish === true && resolvedSeatingMode === 'NUMBERED') {
      return NextResponse.json(
        { error: 'Numbered venues publish after the seat map is built, not at creation. Save as draft, build your seat map, then publish from the venue\'s Edit page.' },
        { status: 400 }
      )
    }

    const venue = await prisma.venue.create({
      data: {
        name,
        address,
        city,
        capacity: finalCapacity,
        acousticRating: acousticRating ? parseFloat(acousticRating) : null,
        mapsUrl: mapsUrl && mapsUrl.trim() ? mapsUrl.trim() : null,
        ownerId: venueOwner.id,
        photos: [],
        facilities: Array.isArray(facilities) ? facilities : [],
        seatMap: resolvedSeatingMode === 'GENERAL_ADMISSION' && sections.length > 0 ? { sections } : undefined,
        seatingMode: resolvedSeatingMode,
        // No admin-review pipeline exists yet, so venue owners publish their own
        // listings directly. Gate this behind real moderation once that exists.
        isApproved: Boolean(publish),
        rateType: rateType || null,
        hourlyRate: rateType === 'HOURLY' && hourlyRate ? parseFloat(hourlyRate) : null,
        dailyRate: rateType === 'DAILY' && dailyRate ? parseFloat(dailyRate) : null,
        minDurationHours: minDurationHours ? parseInt(minDurationHours) : null,
        dayRates: validDayRates.length > 0
          ? {
              create: validDayRates.map((d: any) => ({
                dayOfWeek: d.dayOfWeek,
                hourlyRate: d.hourlyRate ? parseFloat(d.hourlyRate) : null,
                dailyRate: d.dailyRate ? parseFloat(d.dailyRate) : null,
              })),
            }
          : undefined,
      }
    })

    return NextResponse.json(venue, { status: 201 })
  } catch (err) {
    console.error('Error creating venue:', err)
    return NextResponse.json({ error: 'Failed to create venue' }, { status: 500 })
  }
}
