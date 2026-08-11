import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'

// "Book for your event" card (11 Aug, Hitesh: "keep it invite for
// published event") - the card previously promised an invite action
// that didn't exist anywhere in the app (organisers could only review
// applications artists submitted themselves, never the reverse). This
// is the real thing: an organiser picks one of their own PUBLISHED
// events from the artist's profile and places them directly into the
// lineup - same end state as approving an application (Application
// APPROVED + a Performance row), just skipping the artist having to
// apply first since the organiser is the one reaching out. Reuses the
// exact same defaulting logic as PATCH /api/applications/[id] so an
// invited slot and an approved-application slot are indistinguishable
// afterward (same compensation terms, same cancel affordance already
// in the artist dashboard if they can't make it).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user || user.role !== 'ORGANISER') {
      return NextResponse.json({ error: 'Only organisers can invite artists' }, { status: 403 })
    }

    const organiser = await prisma.organiser.findUnique({ where: { userId: user.id } })
    if (!organiser) {
      return NextResponse.json({ error: 'Organiser profile not found' }, { status: 404 })
    }
    if (!organiser.isApproved) {
      return NextResponse.json({ error: 'Your Organiser account is still pending approval' }, { status: 403 })
    }

    const { artistId } = await req.json()
    if (!artistId) {
      return NextResponse.json({ error: 'Missing artistId' }, { status: 400 })
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event || event.organiserId !== organiser.id) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    if (event.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Only published events can invite artists' }, { status: 400 })
    }

    const artist = await prisma.artist.findUnique({ where: { id: artistId } })
    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }

    // Same duplicate guard as POST /api/applications - an artist already
    // applied (in any status) or already performing shouldn't get a
    // second, conflicting row from an invite too.
    const existingApplication = await prisma.application.findFirst({ where: { eventId, artistId } })
    if (existingApplication) {
      return NextResponse.json({ error: 'This artist has already applied to this event' }, { status: 409 })
    }
    const existingPerformance = await prisma.performance.findFirst({ where: { eventId, artistId } })
    if (existingPerformance) {
      return NextResponse.json({ error: 'This artist is already in the lineup' }, { status: 409 })
    }

    if (event.maxPerformers !== null) {
      const filledSlots = await prisma.performance.count({ where: { eventId, cancelledAt: null } })
      if (filledSlots >= event.maxPerformers) {
        return NextResponse.json({ error: "This event's lineup is already full" }, { status: 409 })
      }
    }

    const lineupCount = await prisma.performance.count({ where: { eventId, cancelledAt: null } })

    const [application] = await prisma.$transaction([
      prisma.application.create({
        data: {
          eventId,
          artistId,
          status: 'APPROVED',
          message: `Invited directly by ${organiser.orgName} from the artist's profile.`,
        },
      }),
      prisma.performance.create({
        data: {
          eventId,
          artistId,
          slot: lineupCount + 1,
          duration: 10,
          // Same as an organiser-approved application with no per-artist
          // override - falls back to the event's own declared default
          // terms, shown publicly before this invite (§4.5 reasoning,
          // mirrored from applications/[id]/route.ts).
          compensationType: event.defaultCompensationType,
          feeAmount: event.defaultCompensationType === 'PAID' ? event.defaultFeeAmount : null,
          buyInAmount: event.defaultCompensationType === 'BUY_IN' ? event.defaultBuyInAmount : null,
        },
      }),
    ])

    notifyAfterResponse(
      () =>
        sendPushToUser(artist.userId, {
          title: "You've been invited to perform!",
          body: `${organiser.orgName} added you to the lineup for "${event.title}".`,
          url: '/dashboard/artist/events',
        }),
      'artist-invite'
    )

    return NextResponse.json({ id: application.id }, { status: 201 })
  } catch (err) {
    console.error('[invite-artist POST] error:', err)
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 })
  }
}
