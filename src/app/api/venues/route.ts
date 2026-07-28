import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { requireVerifiedPhone } from '@/lib/verification'
import { isValidMapsUrl } from '@/lib/maps-url'
import { normalizeWhitespace, normalizeForCompare } from '@/lib/text'

export async function GET() {
  try {
    const venues = await prisma.venue.findMany({
      // H3 - same suspension gate as events GET, see comment there.
      where: { isApproved: true, owner: { user: { isSuspended: false } } },
      include: {
        dayRates: true,
        // NUMBERED venues have no seatMap.sections (that field is GA-only
        // dead weight for them) - the event-creation page derives its
        // pricing sections from real Seat/VenueZonePrice data instead.
        // level/row/number/x/y added (28 Jul) to power a read-only layout
        // preview on the event-creation pricing screen - still a select,
        // not a full include, so this stays index-covered and cheap. Payload
        // grows with total seats across every approved venue on the
        // platform (this is the all-venues list endpoint, not per-venue) -
        // fine at current scale, worth revisiting if venue count/seat
        // counts grow large enough to matter.
        seats: { select: { tierLabel: true, level: true, row: true, number: true, x: true, y: true } },
        zonePrices: { select: { level: true, zoneName: true, suggestedPrice: true } },
      },
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
      name, address, city, state, country, lat, lng, placeId, capacity, acousticRating, facilities, seatMap, publish,
      rateType, hourlyRate, dailyRate, minDurationHours, dayRates, mapsUrl, seatingMode,
    } = body

    // Verify-gate only applies at Publish - a Draft isn't a commitment an
    // Organiser plans around yet (see lib/verification.ts doc comment).
    // Body is parsed first so Draft saves for unverified owners always
    // reach here instead of being rejected before their data is even read.
    if (publish === true) {
      const verifyError = requireVerifiedPhone(user, 'publishing this venue - organisers plan real bookings around it')
      if (verifyError) return verifyError
    }

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
    // Name normalized here (trim + collapse internal whitespace), same
    // fix as PATCH /api/venues/[id] - live-observed 27 Jul: "general 2"
    // (one space) and "general    2" (multiple internal spaces) both
    // saved as "unique" under the old `.trim().toLowerCase()` check,
    // which doesn't collapse internal whitespace.
    const sections = Array.isArray(seatMap?.sections)
      ? seatMap.sections.map((s: any) => ({ ...s, name: normalizeWhitespace(String(s?.name ?? '')) }))
      : []
    for (const s of sections) {
      const seatCount = Number(s?.seats)
      // Price is now required to be explicit (28 Jul, fast-follow) - was
      // silently defaulting a missing/blank price to 0, which is exactly
      // what caused the client-side FREE badge to fire on untouched rows
      // (see SeatSectionEditor.tsx's isIncompleteSection note). Server
      // must reject the same way it now rejects a blank name, for
      // defense-in-depth against a direct API call bypassing the UI.
      const priceProvided = s?.price !== undefined && s?.price !== null && s?.price !== ''
      const price = priceProvided ? Number(s.price) : NaN
      // Server-side name-required check: the seat-count/price bounds
      // checks below don't catch a blank name paired with an otherwise
      // valid seat count and price, and duplicate-detection skips empty
      // keys entirely (two blank-named sections aren't "duplicates" of
      // each other, they're each independently incomplete) - so without
      // this, an empty-named section could reach the DB via a direct
      // API call even though the UI now blocks it client-side.
      if (!s.name) {
        return NextResponse.json({ error: 'Every seating section needs a name.' }, { status: 400 })
      }
      if (!Number.isFinite(seatCount) || !Number.isInteger(seatCount) || seatCount < 1 || seatCount > MAX_SEATS_PER_SECTION) {
        return NextResponse.json(
          { error: `Each section's seat count must be a whole number between 1 and ${MAX_SEATS_PER_SECTION.toLocaleString('en-IN')}.` },
          { status: 400 }
        )
      }
      if (!priceProvided) {
        return NextResponse.json({ error: 'Every seating section needs a price (enter 0 for a free section).' }, { status: 400 })
      }
      if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE_PER_SEAT) {
        return NextResponse.json(
          { error: `Price per seat must be between ₹0 and ₹${MAX_PRICE_PER_SEAT.toLocaleString('en-IN')}.` },
          { status: 400 }
        )
      }
    }
    // Duplicate section-name check (added 27 Jul, Hitesh's rule - same
    // one already enforced on the Numbered-venue Seat Map Builder):
    // a GA venue has no concept of levels, so this is simply "no two
    // sections share a name" - live-observed this slipping straight
    // through to Publish with zero validation (4 sections all named
    // "general"). Server-side is the real enforcement point per the
    // client-form-bypasses-native-validation precedent elsewhere in
    // this file. Names are already whitespace-normalized above, so only
    // case remains to fold here.
    const sectionNameCounts = new Map<string, number>()
    for (const s of sections) {
      const key = normalizeForCompare(s.name)
      if (!key) continue
      sectionNameCounts.set(key, (sectionNameCounts.get(key) || 0) + 1)
    }
    const duplicateSectionNames = Array.from(sectionNameCounts.entries()).filter(([, c]) => c > 1).map(([name]) => name)
    if (duplicateSectionNames.length > 0) {
      return NextResponse.json(
        { error: `Section name${duplicateSectionNames.length === 1 ? '' : 's'} "${duplicateSectionNames.join('", "')}" ${duplicateSectionNames.length === 1 ? 'is' : 'are'} used more than once - each section needs a unique name.` },
        { status: 400 }
      )
    }
    if (acousticRating !== undefined && acousticRating !== null && acousticRating !== '') {
      const rating = Number(acousticRating)
      if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
        return NextResponse.json({ error: 'Acoustic rating must be between 0 and 5.' }, { status: 400 })
      }
    }
    if (mapsUrl && mapsUrl.trim() && !isValidMapsUrl(mapsUrl)) {
      return NextResponse.json({ error: 'Please paste a real Google Maps link (e.g. from the Share button on Google Maps).' }, { status: 400 })
    }
    // Real coordinates from the Address autocomplete lookup - same
    // "always validate server-side, never trust the client" discipline
    // as every other numeric input in this app. Silently dropped (not a
    // hard error) if out of range or non-numeric, since these are a
    // nice-to-have (Get Directions link) rather than something the rest
    // of registration should ever block on.
    const parsedLat = lat !== undefined && lat !== null && lat !== '' ? Number(lat) : null
    const parsedLng = lng !== undefined && lng !== null && lng !== '' ? Number(lng) : null
    const validLat = parsedLat !== null && Number.isFinite(parsedLat) && parsedLat >= -90 && parsedLat <= 90 ? parsedLat : null
    const validLng = parsedLng !== null && Number.isFinite(parsedLng) && parsedLng >= -180 && parsedLng <= 180 ? parsedLng : null
    // placeId is only meaningful alongside real coordinates (PR #212) -
    // if lat/lng didn't validate, don't persist a placeId that would
    // then be the only surviving signal that autocomplete was used.
    const validPlaceId = validLat !== null && validLng !== null && typeof placeId === 'string' && placeId.trim() ? placeId.trim() : null
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
        // Both optional/nullable - only populated when the owner picks a
        // suggestion from the new Places autocomplete; a manually-typed
        // city (no dropdown match) leaves these null, same as any
        // pre-existing venue.
        state: state && String(state).trim() ? String(state).trim() : null,
        country: country && String(country).trim() ? String(country).trim() : null,
        lat: validLat,
        lng: validLng,
        placeId: validPlaceId,
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
