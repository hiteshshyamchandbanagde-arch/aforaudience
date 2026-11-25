import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { recomputeTourStatus } from '@/lib/tours'

// PATCH /api/tour-invites/[consentId]/respond
// body: { accept: boolean }
//
// Tour by Organiser (12 Aug) - artist consent, same shape as the
// existing panelist-invites/respond route. Only the invited artist can
// respond to their own invite.
//
// On decline: auto-cancels every active Performance this artist has on
// THIS Tour's stops (not just one stop) - a decline means they're not
// doing the Tour, full stop, so leaving stale lineup rows around would
// misrepresent who's actually performing. The organiser then re-invites
// a replacement via POST /api/events/[id]/tour-lineup per stop.
export async function PATCH(req: Request, { params }: { params: Promise<{ consentId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id
  const { consentId } = await params

  const body = await req.json().catch(() => ({}))
  if (typeof body.accept !== 'boolean') {
    return NextResponse.json({ error: 'accept (boolean) is required' }, { status: 400 })
  }

  const consent = await prisma.tourArtistConsent.findUnique({
    where: { id: consentId },
    include: { artist: true },
  })
  if (!consent) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }
  if (consent.artist.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (consent.status !== 'PENDING') {
    return NextResponse.json({ error: 'This invite has already been responded to' }, { status: 409 })
  }

  const updated = await prisma.tourArtistConsent.update({
    where: { id: consentId },
    data: { status: body.accept ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() },
  })

  if (!body.accept) {
    const stops = await prisma.event.findMany({ where: { tourId: consent.tourId }, select: { id: true } })
    const stopIds = stops.map((s) => s.id)
    if (stopIds.length > 0) {
      await prisma.performance.updateMany({
        where: { eventId: { in: stopIds }, artistId: consent.artistId, cancelledAt: null },
        data: { cancelledAt: new Date() },
      })
    }
  }

  await recomputeTourStatus(consent.tourId)

  return NextResponse.json({ consent: updated })
}
