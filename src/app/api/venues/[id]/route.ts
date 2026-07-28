import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isValidMapsUrl } from '@/lib/maps-url'
import { requireVerifiedPhone } from '@/lib/verification'
import { normalizeWhitespace, normalizeForCompare } from '@/lib/text'

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
    const { name, address, city, state, country, lat, lng, placeId, capacity, acousticRating, facilities, seatMap, publish, mapsUrl, rateType, hourlyRate, dailyRate, minDurationHours, dayRates } = body

    // Verify-gate at Publish - was entirely missing from this route (only
    // POST /api/venues, i.e. create, had it). This meant an unverified
    // owner could bypass verification by saving a venue as Draft first,
    // then publishing it later via Edit instead of at creation - the
    // exact gap Feedback flagged ("Venue publish without verify mobile
    // number"). Same guard, same condition, as create.
    if (publish === true) {
      const verifyError = requireVerifiedPhone(user, 'publishing this venue - organisers plan real bookings around it')
      if (verifyError) return verifyError
    }

    if (mapsUrl !== undefined && mapsUrl && mapsUrl.trim() && !isValidMapsUrl(mapsUrl)) {
      return NextResponse.json({ error: 'Please paste a real Google Maps link (e.g. from the Share button on Google Maps).' }, { status: 400 })
    }

    // Same rate-type validation as POST /api/venues (create) - the edit
    // form was previously missing this whole section entirely, so a
    // venue owner had no way to update their rental rate post-creation
    // (session 39 finding).
    if (rateType !== undefined && rateType !== null && !['HOURLY', 'DAILY', 'FLEXIBLE'].includes(rateType)) {
      return NextResponse.json({ error: 'Invalid rate type' }, { status: 400 })
    }
    if (rateType === 'HOURLY' && !(Number(hourlyRate) > 0)) {
      return NextResponse.json({ error: 'Set an hourly rate' }, { status: 400 })
    }
    if (rateType === 'DAILY' && !(Number(dailyRate) > 0)) {
      return NextResponse.json({ error: 'Set a daily rate' }, { status: 400 })
    }
    const validDayRates = Array.isArray(dayRates)
      ? dayRates.filter((d: any) =>
          ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].includes(d?.dayOfWeek)
          && (Number(d.hourlyRate) > 0 || Number(d.dailyRate) > 0)
        )
      : []

    // Name normalized here (trim + collapse internal whitespace) at the
    // single point sections enter the request - this form's custom
    // onChange handlers bypass native validation entirely (same
    // precedent as the seat-count/price bounds checks below), so this is
    // the real enforcement point, not just the dup-check that follows.
    // Live-observed 27 Jul: "general 2" (one space) and "general    2"
    // (multiple internal spaces) both saved as "unique" sections under
    // the old `.trim().toLowerCase()` check, which doesn't collapse
    // internal whitespace.
    const sections = Array.isArray(seatMap?.sections)
      ? seatMap.sections.map((s: any) => ({ ...s, name: normalizeWhitespace(String(s?.name ?? '')) }))
      : undefined

    // Bounds check - this route was missing the seat-count/price bounds
    // validation that POST /api/venues already has (found in the same
    // quality pass as the name-required check below). Without it, a
    // PATCH could push an unbounded seat count or a negative/absurd
    // price straight to the DB, since this form's custom onChange
    // handlers bypass native HTML validation same as everywhere else in
    // this file. Only runs when sections are actually part of the
    // request.
    const MAX_SEATS_PER_SECTION = 100_000
    const MAX_PRICE_PER_SEAT = 10_000_000 // ₹1 crore
    if (sections !== undefined) {
      for (const s of sections) {
        const seatCount = Number(s?.seats)
        const price = s?.price !== undefined && s?.price !== null && s?.price !== '' ? Number(s.price) : 0
        // Name-required: seat-count/price bounds alone don't catch a
        // blank name paired with an otherwise-valid seat count, and
        // duplicate-detection below skips empty keys entirely (two
        // blank-named sections aren't "duplicates" of each other).
        if (!s.name) {
          return NextResponse.json({ error: 'Every seating section needs a name.' }, { status: 400 })
        }
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
    }

    const seatMapCapacity = sections
      ? sections.reduce((sum: number, s: any) => sum + (Number(s.seats) || 0), 0)
      : undefined

    // Duplicate section-name check (added 27 Jul) - same rule as
    // POST /api/venues and the Numbered-venue Seat Map Builder: a GA
    // venue has no level concept, so this is simply "no two sections
    // share a name." Only runs when sections are actually part of this
    // request (optional field on PATCH). Names are already whitespace-
    // normalized above, so only case remains to fold here.
    if (sections !== undefined) {
      const sectionNameCounts = new Map<string, number>()
      for (const s of sections) {
        const key = normalizeForCompare(s.name)
        if (!key) continue
        sectionNameCounts.set(key, (sectionNameCounts.get(key) || 0) + 1)
      }
      const duplicateSectionNames = Array.from(sectionNameCounts.entries()).filter(([, c]) => c > 1).map(([n]) => n)
      if (duplicateSectionNames.length > 0) {
        return NextResponse.json(
          { error: `Section name${duplicateSectionNames.length === 1 ? '' : 's'} "${duplicateSectionNames.join('", "')}" ${duplicateSectionNames.length === 1 ? 'is' : 'are'} used more than once - each section needs a unique name.` },
          { status: 400 }
        )
      }
    }

    // Identity-lock guard (session 39) - Event.venueId/Venue.seatMap are
    // live mutable references with no snapshotting (Feedback 94071451,
    // still needs its own design pass on full scope: lock vs snapshot vs
    // warn). Until that's designed, this stops the immediate real risk -
    // an owner silently changing name/address/seat map after audience
    // tickets have already been sold against the current layout. Only
    // blocks identity-critical fields; facilities, rate, acoustic rating,
    // and publish toggle are unaffected. Only compares fields the request
    // actually tries to change, so a no-op resubmission of the same
    // values isn't blocked.
    const nameChanging = name !== undefined && name !== venue.name
    const addressChanging = address !== undefined && address !== venue.address
    const cityChanging = city !== undefined && city !== venue.city
    const seatMapChanging = sections !== undefined && JSON.stringify(sections) !== JSON.stringify((venue.seatMap as any)?.sections || [])
    if (nameChanging || addressChanging || cityChanging || seatMapChanging) {
      const hasLiveEvent = await prisma.event.findFirst({
        where: { venueId: id, status: 'APPROVED' },
        select: { id: true },
      })
      if (hasLiveEvent) {
        return NextResponse.json(
          { error: 'This venue has a published event with tickets on sale, so its name, address, and seat map are locked to protect ticket-holders. Facilities, rate, and other settings can still be updated. Contact support if the venue itself has genuinely changed.' },
          { status: 400 }
        )
      }
    }

    // Computed once so placeId's validity can consistently depend on
    // lat/lng's validity (PR #212) - same "all three set/cleared
    // together" rule as create.
    const validLat = lat !== undefined
      ? (() => {
          const n = lat !== null && lat !== '' ? Number(lat) : null
          return n !== null && Number.isFinite(n) && n >= -90 && n <= 90 ? n : null
        })()
      : undefined
    const validLng = lng !== undefined
      ? (() => {
          const n = lng !== null && lng !== '' ? Number(lng) : null
          return n !== null && Number.isFinite(n) && n >= -180 && n <= 180 ? n : null
        })()
      : undefined
    const validPlaceId = placeId !== undefined
      ? (validLat && validLng && typeof placeId === 'string' && placeId.trim() ? placeId.trim() : null)
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
        ...(validLat !== undefined && { lat: validLat }),
        ...(validLng !== undefined && { lng: validLng }),
        ...(validPlaceId !== undefined && { placeId: validPlaceId }),
        ...(seatMapCapacity !== undefined ? { capacity: seatMapCapacity } : capacity ? { capacity } : {}),
        ...(acousticRating !== undefined && { acousticRating }),
        ...(mapsUrl !== undefined && { mapsUrl: mapsUrl && mapsUrl.trim() ? mapsUrl.trim() : null }),
        ...(facilities !== undefined && { facilities: Array.isArray(facilities) ? facilities : [] }),
        ...(sections !== undefined && { seatMap: { sections } }),
        ...(publish !== undefined && { isApproved: Boolean(publish) }),
        ...(rateType !== undefined && {
          rateType: rateType || null,
          hourlyRate: rateType === 'HOURLY' && hourlyRate ? parseFloat(hourlyRate) : null,
          dailyRate: rateType === 'DAILY' && dailyRate ? parseFloat(dailyRate) : null,
          minDurationHours: minDurationHours ? parseInt(minDurationHours) : null,
          dayRates: {
            deleteMany: {},
            ...(validDayRates.length > 0 && {
              create: validDayRates.map((d: any) => ({
                dayOfWeek: d.dayOfWeek,
                hourlyRate: d.hourlyRate ? parseFloat(d.hourlyRate) : null,
                dailyRate: d.dailyRate ? parseFloat(d.dailyRate) : null,
              })),
            }),
          },
        }),
      }
    })

    return NextResponse.json(updatedVenue)
  } catch (err) {
    console.error('Error updating venue:', err)
    return NextResponse.json({ error: 'Failed to update venue' }, { status: 500 })
  }
}

