import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/events/upcoming?city=X&limit=5
//
// Purpose-built for the homepage "Tonight, near you" rail (Editorial
// Split hero, FEAT-2608-030 / resumes BUG-2607-036 + FEAT-2607-028).
// Deliberately NOT reusing the full /api/events route: that route does
// per-event NUMBERED-venue seat-availability computation (BookingSeat
// groupBy + held-seat filtering) which is unnecessary weight for a
// homepage widget that just needs title/time/venue/city for a handful
// of upcoming events. If this rail ever needs live seat counts, revisit
// sharing logic rather than copying the full computation here.
//
// Only future events (date >= now), same APPROVED-only + non-suspended-
// organiser visibility rule as the public listing. city is optional -
// omitted/no match falls back to city-agnostic "soonest anywhere",
// so the rail is never empty just because we don't know the visitor's
// city yet (e.g. location permission not yet resolved).

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const city = searchParams.get('city')?.trim() || null
    const limitParam = parseInt(searchParams.get('limit') || '5', 10)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 10) : 5

    const now = new Date()
    const baseWhere = {
      status: 'APPROVED' as const,
      date: { gte: now },
      organiser: { user: { isSuspended: false } },
    }

    let events = city
      ? await prisma.event.findMany({
          where: { ...baseWhere, venue: { city } },
          select: {
            id: true,
            title: true,
            type: true,
            date: true,
            startTime: true,
            venue: { select: { name: true, city: true } },
          },
          orderBy: { date: 'asc' },
          take: limit,
        })
      : []

    // City had no upcoming events (or city unknown) - fall back to
    // soonest anywhere rather than showing an empty rail.
    if (events.length === 0) {
      events = await prisma.event.findMany({
        where: baseWhere,
        select: {
          id: true,
          title: true,
          type: true,
          date: true,
          startTime: true,
          venue: { select: { name: true, city: true } },
        },
        orderBy: { date: 'asc' },
        take: limit,
      })
    }

    return NextResponse.json({ events, matchedCity: city && events.some((e: { venue: { city: string } | null }) => e.venue?.city === city) ? city : null })
  } catch (err) {
    console.error('GET /api/events/upcoming error', err)
    return NextResponse.json({ events: [], matchedCity: null }, { status: 200 })
  }
}
