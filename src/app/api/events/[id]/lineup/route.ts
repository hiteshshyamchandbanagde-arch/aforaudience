import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/events/[id]/lineup — organiser (owner) or admin only.
// Returns the event's Performance rows (the "lineup") in slot order,
// each joined to the Artist's display name, plus a computed time block
// (start/end) derived from the event's own startTime + the cumulative
// duration of everything before it in the order. Time blocks are
// computed here rather than stored, so reordering never leaves stale
// start times lying around — they're always a pure function of
// (event.startTime, current slot order, durations).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN') {
      const organiser = await prisma.organiser.findUnique({ where: { id: event.organiserId } })
      if (!organiser || organiser.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const performances = await prisma.performance.findMany({
      where: { eventId, cancelledAt: null },
      include: { artist: { include: { user: { select: { name: true, displayName: true } } } } },
      orderBy: { slot: 'asc' },
    })

    const lineup = computeTimeBlocks(event.startTime, performances)

    return NextResponse.json({
      event: { id: event.id, title: event.title, startTime: event.startTime, endTime: event.endTime, maxPerformers: event.maxPerformers },
      lineup,
    })
  } catch (err) {
    console.error('Error fetching lineup:', err)
    return NextResponse.json({ error: 'Failed to fetch lineup' }, { status: 500 })
  }
}

// PATCH /api/events/[id]/lineup — organiser (owner) or admin only.
// Body: { order: [{ performanceId, duration }] } in the desired new
// order (array index becomes the new slot number, 1-based). Duration is
// in minutes, clamped to a sane 1-180 range so a typo can't produce a
// nonsensical multi-day lineup slot.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN') {
      const organiser = await prisma.organiser.findUnique({ where: { id: event.organiserId } })
      if (!organiser || organiser.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const { order } = await req.json()
    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json({ error: 'Missing order array' }, { status: 400 })
    }

    // Ownership check on every performanceId — never trust the client to
    // only send IDs that actually belong to this event.
    const existing = await prisma.performance.findMany({ where: { eventId, cancelledAt: null }, select: { id: true } })
    const validIds = new Set(existing.map((p) => p.id))
    for (const item of order) {
      if (!item?.performanceId || !validIds.has(item.performanceId)) {
        return NextResponse.json({ error: 'Lineup order references a slot outside this event' }, { status: 400 })
      }
    }
    if (order.length !== existing.length) {
      return NextResponse.json({ error: 'Order must include every slot in the lineup' }, { status: 400 })
    }

    await prisma.$transaction(
      order.map((item: { performanceId: string; duration: number }, index: number) =>
        prisma.performance.update({
          where: { id: item.performanceId },
          data: {
            slot: index + 1,
            duration: Math.max(1, Math.min(180, Math.round(Number(item.duration) || 10))),
          },
        })
      )
    )

    const performances = await prisma.performance.findMany({
      where: { eventId, cancelledAt: null },
      include: { artist: { include: { user: { select: { name: true, displayName: true } } } } },
      orderBy: { slot: 'asc' },
    })
    const lineup = computeTimeBlocks(event.startTime, performances)

    return NextResponse.json({ lineup })
  } catch (err) {
    console.error('Error updating lineup:', err)
    return NextResponse.json({ error: 'Failed to update lineup' }, { status: 500 })
  }
}

function computeTimeBlocks(eventStartTime: string, performances: any[]) {
  // event.startTime is stored as a free-text string (e.g. "19:00" or
  // "7:00 PM") elsewhere in the app — parse defensively, fall back to
  // not showing computed clock times if it doesn't parse rather than
  // guessing wrong.
  const base = parseTimeToMinutes(eventStartTime)
  let cursor = base ?? 0

  return performances.map((p) => {
    const startMinutes = cursor
    const endMinutes = cursor + p.duration
    if (base !== null) cursor = endMinutes

    return {
      id: p.id,
      slot: p.slot,
      duration: p.duration,
      artistId: p.artistId,
      artistName: p.artist.user.displayName || p.artist.user.name,
      compensationType: p.compensationType,
      feeAmount: p.feeAmount,
      buyInAmount: p.buyInAmount,
      startLabel: base !== null ? minutesToLabel(startMinutes) : null,
      endLabel: base !== null ? minutesToLabel(endMinutes) : null,
    }
  })
}

function parseTimeToMinutes(value: string): number | null {
  if (!value) return null
  // "HH:MM" 24-hour
  let m = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (m) {
    const h = parseInt(m[1], 10)
    const min = parseInt(m[2], 10)
    if (h >= 0 && h < 24 && min >= 0 && min < 60) return h * 60 + min
  }
  // "7:00 PM" / "7:00pm" 12-hour
  m = value.trim().match(/^(\d{1,2}):(\d{2})\s*([APap][Mm])$/)
  if (m) {
    let h = parseInt(m[1], 10) % 12
    const min = parseInt(m[2], 10)
    if (/pm/i.test(m[3])) h += 12
    return h * 60 + min
  }
  return null
}

function minutesToLabel(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440
  const h24 = Math.floor(wrapped / 60)
  const min = wrapped % 60
  const period = h24 < 12 ? 'AM' : 'PM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(min).padStart(2, '0')} ${period}`
}
