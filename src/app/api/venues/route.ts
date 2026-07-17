import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const venues = await prisma.venue.findMany({
      where: { isApproved: true },
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

    const body = await req.json()
    const {
      name, address, city, capacity, acousticRating, facilities, seatMap, publish,
      rateType, hourlyRate, dailyRate, minDurationHours, dayRates, mapsUrl,
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
    const sections = Array.isArray(seatMap?.sections) ? seatMap.sections : []
    const seatMapCapacity = sections.reduce((sum: number, s: any) => sum + (Number(s.seats) || 0), 0)
    const finalCapacity = sections.length > 0 ? seatMapCapacity : parseInt(capacity)

    if (!finalCapacity || finalCapacity < 1) {
      return NextResponse.json(
        { error: 'Add at least one seating section, or provide a seating capacity' },
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
        seatMap: sections.length > 0 ? { sections } : undefined,
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
