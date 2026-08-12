import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'
import { recomputeTourStatus } from '@/lib/tours'

// POST /api/events/[id]/tour-lineup
// body: { artistId: string }
//
// Adds an artist to a Tour stop's FIXED lineup. Deliberately separate
// from POST /api/events/[id]/invite-artist, which requires the event to
// already be APPROVED (published) - a Tour stop is usually still DRAFT
// while consent is outstanding, so lineup composition has to work
// before publish, not after.
//
// Creates the same Application(APPROVED)+Performance pair invite-artist
// does (so an invited Tour Stop slot is indistinguishable from any other
// lineup placement afterward), plus upserts a TourArtistConsent for this
// artist on the stop's Tour - PENDING if new, reset to PENDING if they
// previously declined (re-invite), left alone if already ACCEPTED (they
// consented once for this Tour, no need to ask again per stop).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user || user.role !== 'ORGANISER') {
      return NextResponse.json({ error: 'Only organisers can manage a Tour stop lineup' }, { status: 403 })
    }

    const organiser = await prisma.organiser.findUnique({ where: { userId: user.id } })
    if (!organiser) {
      return NextResponse.json({ error: 'Organiser profile not found' }, { status: 404 })
    }

    const { artistId } = await req.json().catch(() => ({}))
    if (!artistId) {
      return NextResponse.json({ error: 'Missing artistId' }, { status: 400 })
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event || event.organiserId !== organiser.id) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    if (event.category !== 'TOUR_STOP' || !event.tourId) {
      return NextResponse.json({ error: 'This action only applies to Tour stops' }, { status: 400 })
    }

    const artist = await prisma.artist.findUnique({ where: { id: artistId } })
    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }

    const existingApplication = await prisma.application.findFirst({ where: { eventId, artistId } })
    if (existingApplication) {
      return NextResponse.json({ error: 'This artist has already applied to this event' }, { status: 409 })
    }
    const existingPerformance = await prisma.performance.findFirst({ where: { eventId, artistId, cancelledAt: null } })
    if (existingPerformance) {
      return NextResponse.json({ error: 'This artist is already in the lineup' }, { status: 409 })
    }

    const lineupCount = await prisma.performance.count({ where: { eventId, cancelledAt: null } })

    const [, performance] = await prisma.$transaction([
      prisma.application.create({
        data: {
          eventId,
          artistId,
          status: 'APPROVED',
          message: `Placed by ${organiser.orgName} as part of a Tour lineup.`,
        },
      }),
      prisma.performance.create({
        data: {
          eventId,
          artistId,
          slot: lineupCount + 1,
          duration: 10,
          compensationType: event.defaultCompensationType,
          feeAmount: event.defaultCompensationType === 'PAID' ? event.defaultFeeAmount : null,
          buyInAmount: event.defaultCompensationType === 'BUY_IN' ? event.defaultBuyInAmount : null,
        },
      }),
    ])

    // Consent: find first, since the branch depends on the PRIOR status
    // (leave ACCEPTED alone, reset DECLINED to PENDING, create fresh if
    // none exists) - clearer as an explicit find+create/update than an
    // upsert whose update branch would otherwise have to be a no-op.
    const existingConsent = await prisma.tourArtistConsent.findUnique({
      where: { tourId_artistId: { tourId: event.tourId, artistId } },
    })
    let consentStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED'
    if (!existingConsent) {
      const created = await prisma.tourArtistConsent.create({
        data: { tourId: event.tourId, artistId, status: 'PENDING' },
      })
      consentStatus = created.status as typeof consentStatus
    } else if (existingConsent.status === 'DECLINED') {
      const updated = await prisma.tourArtistConsent.update({
        where: { id: existingConsent.id },
        data: { status: 'PENDING', respondedAt: null },
      })
      consentStatus = updated.status as typeof consentStatus
    } else {
      consentStatus = existingConsent.status as typeof consentStatus
    }

    await recomputeTourStatus(event.tourId)

    if (consentStatus !== 'ACCEPTED') {
      notifyAfterResponse(
        () =>
          sendPushToUser(artist.userId, {
            title: "You've been invited to a Tour!",
            body: `${organiser.orgName} added you to a Tour stop - please confirm.`,
            url: '/dashboard/artist',
          }),
        'tour-artist-invite'
      )
    }

    return NextResponse.json({ performanceId: performance.id, consentStatus }, { status: 201 })
  } catch (err) {
    console.error('[tour-lineup POST] error:', err)
    return NextResponse.json({ error: 'Failed to add artist to Tour stop' }, { status: 500 })
  }
}

// DELETE /api/events/[id]/tour-lineup?artistId=xxx
// Organiser removes an artist from a Tour stop's fixed lineup (e.g.
// after a decline, before inviting a replacement). Cancels their
// Performance row - does not touch TourArtistConsent, since that's
// scoped to the whole Tour, not this one stop.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params
    const { searchParams } = new URL(req.url)
    const artistId = searchParams.get('artistId')
    if (!artistId) {
      return NextResponse.json({ error: 'Missing artistId' }, { status: 400 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user || user.role !== 'ORGANISER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const organiser = await prisma.organiser.findUnique({ where: { userId: user.id } })
    if (!organiser) {
      return NextResponse.json({ error: 'Organiser profile not found' }, { status: 404 })
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event || event.organiserId !== organiser.id) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const performance = await prisma.performance.findFirst({ where: { eventId, artistId, cancelledAt: null } })
    if (!performance) {
      return NextResponse.json({ error: 'This artist is not in the lineup' }, { status: 404 })
    }

    await prisma.performance.update({ where: { id: performance.id }, data: { cancelledAt: new Date() } })

    if (event.tourId) await recomputeTourStatus(event.tourId)

    return NextResponse.json({ removed: true })
  } catch (err) {
    console.error('[tour-lineup DELETE] error:', err)
    return NextResponse.json({ error: 'Failed to remove artist from Tour stop' }, { status: 500 })
  }
}
