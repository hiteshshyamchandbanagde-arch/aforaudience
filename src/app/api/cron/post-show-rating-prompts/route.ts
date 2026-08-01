import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendPushToUser } from '@/lib/push'
import { getEventEndDateTime } from '@/lib/eventTime'

// Reputation epic §5 - post-show rating prompt. Runs on a schedule (see
// vercel.json crons) rather than a per-event timer, since Vercel has no
// built-in "run this once at instant X" primitive - polling on an
// interval and checking ratingPromptSentAt for idempotency is the
// standard pattern for this.
//
// Window: fires for any checked-in booking whose event ended within the
// last CATCH_UP_HOURS and hasn't been prompted yet. The catch-up window
// exists so a deploy hiccup or cron miss doesn't silently skip a whole
// batch of prompts - but it's capped so a booking from weeks ago never
// gets a stale "how was the show" push if this job was down for a while.
const CATCH_UP_HOURS = 6

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const catchUpFloor = new Date(now.getTime() - CATCH_UP_HOURS * 60 * 60 * 1000)

    // Can't filter "event has ended" directly in SQL since end time is
    // derived from date + endTime string, not a stored DateTime - so pull
    // candidates by a loose date bound, then filter precisely in code.
    const candidates = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        checkedInAt: { not: null },
        ratingPromptSentAt: null,
        event: { date: { gte: new Date(catchUpFloor.getTime() - 24 * 60 * 60 * 1000), lte: now } },
      },
      select: {
        id: true,
        userId: true,
        event: { select: { id: true, title: true, date: true, startTime: true, endTime: true } },
      },
    })

    let sent = 0
    const sentIds: string[] = []

    for (const booking of candidates) {
      const endsAt = getEventEndDateTime(booking.event)
      if (endsAt > now || endsAt < catchUpFloor) continue

      await sendPushToUser(booking.userId, {
        title: 'How was the show?',
        body: `Rate ${booking.event.title} - rating a performer gets you early word on their next show.`,
        url: `/events/${booking.event.id}/rate`,
      })
      sentIds.push(booking.id)
      sent++
    }

    if (sentIds.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: sentIds } },
        data: { ratingPromptSentAt: now },
      })
    }

    return NextResponse.json({ checked: candidates.length, sent })
  } catch (err) {
    console.error('[cron] post-show-rating-prompts failed', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
