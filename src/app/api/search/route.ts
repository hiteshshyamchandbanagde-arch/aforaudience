import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Combined search - one entry point for Events/Artists/Venues, grouped,
// for the inline header dropdown. Simple `contains`/insensitive matching
// (Postgres ILIKE under the hood via Prisma) - no full-text search infra,
// this is hobby-scale, not enterprise search. Each group capped at 5 so
// the dropdown stays scannable.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()

  if (q.length < 2) {
    return NextResponse.json({ events: [], artists: [], venues: [] })
  }

  const [events, artists, venues] = await Promise.all([
    prisma.event.findMany({
      where: {
        status: 'APPROVED',
        organiser: { user: { isSuspended: false } },
        title: { contains: q, mode: 'insensitive' },
      },
      select: { id: true, title: true, date: true, venue: { select: { city: true } } },
      take: 5,
      orderBy: { date: 'asc' },
    }),
    prisma.artist.findMany({
      where: {
        OR: [
          { user: { name: { contains: q, mode: 'insensitive' } } },
          { user: { displayName: { contains: q, mode: 'insensitive' } } },
        ],
      },
      select: { id: true, genre: true, user: { select: { name: true, displayName: true } } },
      take: 5,
    }),
    prisma.venue.findMany({
      where: { isApproved: true, name: { contains: q, mode: 'insensitive' } },
      select: { id: true, name: true, city: true },
      take: 5,
    }),
  ])

  return NextResponse.json({
    events: events.map((e) => ({ id: e.id, title: e.title, date: e.date, city: e.venue?.city ?? null })),
    artists: artists.map((a) => ({ id: a.id, name: a.user.displayName || a.user.name, genre: a.genre[0] ?? null })),
    venues: venues.map((v) => ({ id: v.id, name: v.name, city: v.city })),
  })
}
