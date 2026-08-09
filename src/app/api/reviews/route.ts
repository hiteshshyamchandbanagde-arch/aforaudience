import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'
import { ensureFollowing } from '@/lib/follow'

// GEN-2608-027 - combines Event.date + startTime into a real instant,
// same pattern already used in bookings/[id]/route.ts,
// performances/[id]/cancel/route.ts, and POST /api/events (backdated-event
// validation). No shared lib for this exists yet across those call sites,
// so following the established per-file convention here too rather than
// introducing a refactor under this bug fix's banner.
function eventStartInstant(date: Date, startTime: string): Date {
  const [h, m] = startTime.split(':').map(Number)
  const start = new Date(date)
  start.setHours(h, m, 0, 0)
  return start
}

// G2 - rate a performer post-show. Gated on the reviewer having an actual
// CONFIRMED + checked-in booking for this event - EPIC N's check-in
// system (src/app/api/events/[id]/checkin) now exists, so this can
// finally be tightened as the original comment here flagged. Without
// this, anyone logged in could rate an event/performer they never
// attended.
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventId, performanceId, rating, comment } = await req.json()

    if (!eventId || !rating || Number(rating) < 1 || Number(rating) > 5) {
      return NextResponse.json({ error: 'A rating from 1 to 5 is required' }, { status: 400 })
    }

    const checkedInBooking = await prisma.booking.findFirst({
      where: { userId: user.id, eventId, status: 'CONFIRMED', checkedInAt: { not: null } },
      include: { event: { select: { date: true, startTime: true } } },
    })
    if (!checkedInBooking) {
      return NextResponse.json(
        { error: 'You can review this event after checking in at the door.' },
        { status: 403 }
      )
    }

    // GEN-2608-027 - checked-in alone isn't sufficient: an organiser can
    // scan a booking in ahead of the actual show (early doors, or by
    // mistake/testing), which previously let someone rate performances
    // for an event that hadn't happened yet.
    if (eventStartInstant(checkedInBooking.event.date, checkedInBooking.event.startTime).getTime() > Date.now()) {
      return NextResponse.json(
        { error: "You can review this event once it's actually happened." },
        { status: 403 }
      )
    }

    const existing = await prisma.review.findFirst({
      where: { userId: user.id, eventId, performanceId: performanceId || null },
    })
    if (existing) {
      return NextResponse.json({ error: "You've already reviewed this performer for this event" }, { status: 409 })
    }

    const review = await prisma.review.create({
      data: {
        userId: user.id,
        eventId,
        performanceId: performanceId || null,
        rating: Number(rating),
        comment: comment?.trim() || null,
      },
    })

    // Performer-specific review -> the artist who was rated. General
    // event review (no performanceId) -> the event's Organiser. No direct
    // Review->Venue link exists in the schema, so Venue Owners aren't
    // notified here yet - would need a schema change to trace a review
    // back to a specific venue booking.
    if (performanceId) {
      const performance = await prisma.performance.findUnique({
        where: { id: performanceId },
        include: { artist: true },
      })
      if (performance) {
        notifyAfterResponse(
          () =>
            sendPushToUser(performance.artist.userId, {
              title: `New ${Number(rating)}★ review`,
              body: comment?.trim() ? `"${comment.trim().slice(0, 80)}"` : 'Someone rated your performance.',
              url: '/dashboard/artist',
            }),
          'review-artist'
        )
        // Reputation epic §5 nudge - rating a performer earns automatic
        // early access to their next event (Follow + notify, silent if
        // already following).
        ensureFollowing(user.id, 'ARTIST', performance.artistId).catch((err) =>
          console.error('[reviews] ensureFollowing nudge failed', err)
        )
      }
    } else {
      const event = await prisma.event.findUnique({ where: { id: eventId }, include: { organiser: true } })
      if (event) {
        notifyAfterResponse(
          () =>
            sendPushToUser(event.organiser.userId, {
              title: `New ${Number(rating)}★ review for ${event.title}`,
              body: comment?.trim() ? `"${comment.trim().slice(0, 80)}"` : 'A new review came in.',
              url: `/dashboard/organiser/events/${eventId}`,
            }),
          'review-organiser'
        )
      }
    }

    return NextResponse.json(review, { status: 201 })
  } catch (err) {
    console.error('Error creating review:', err)
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 })
  }
}
