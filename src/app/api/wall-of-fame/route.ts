import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/wall-of-fame
//
// "Wall of Fame" — Artist of the Month / Event of the Month, computed
// directly from Review.rating. Decision from design.md §9.3:
//   - Minimum 3 reviews to qualify (same floor as the Top
//     Venues/Organisers proxy, for consistency)
//   - Scoped to the current calendar month, not a rolling 30 days
//
// Also serves Top Venues / Top Organisers — a separate §9.3 decision:
// same 3-review floor, but deliberately NOT calendar-month scoped.
// design.md only attaches the monthly window to the "of the Month"
// awards; the leaderboard is described as an ongoing ranking ("Top
// Venues/Organisers"), not a monthly one, so it aggregates all-time.
//
// No new schema — Review already ties to Event and (optionally) to a
// Performance, which ties to an Artist. Review volume is low enough
// (mirrors the ~20-lifetime-booking scale noted on the admin bookings
// page) that aggregating in JS after one findMany is simpler and safer
// than a raw-SQL groupBy across two levels (Review -> Performance ->
// Artist can't be expressed in a single Prisma groupBy since artistId
// isn't a field on Review; same reasoning applies to Event -> Venue /
// Event -> Organiser for the leaderboard).
const MIN_REVIEWS = 3
const LEADERBOARD_SIZE = 5

export async function GET() {
  try {
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    const monthLabel = monthStart.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

    const reviews = await prisma.review.findMany({
      where: { createdAt: { gte: monthStart, lt: monthEnd } },
      select: {
        rating: true,
        eventId: true,
        event: { select: { id: true, title: true, posterImage: true, date: true } },
        performanceId: true,
        performance: {
          select: {
            artistId: true,
            artist: { select: { id: true, hypScore: true, user: { select: { name: true, displayName: true, avatar: true } } } },
          },
        },
      },
    })

    // Event of the Month
    const eventAgg = new Map<string, { count: number; sum: number; event: { id: string; title: string; posterImage: string | null; date: Date } }>()
    for (const r of reviews) {
      const existing = eventAgg.get(r.eventId)
      if (existing) {
        existing.count += 1
        existing.sum += r.rating
      } else {
        eventAgg.set(r.eventId, { count: 1, sum: r.rating, event: r.event })
      }
    }
    let eventOfMonth: { id: string; title: string; posterImage: string | null; avgRating: number; reviewCount: number } | null = null
    for (const { count, sum, event } of eventAgg.values()) {
      if (count < MIN_REVIEWS) continue
      const avg = sum / count
      if (!eventOfMonth || avg > eventOfMonth.avgRating || (avg === eventOfMonth.avgRating && count > eventOfMonth.reviewCount)) {
        eventOfMonth = { id: event.id, title: event.title, posterImage: event.posterImage, avgRating: avg, reviewCount: count }
      }
    }

    // Artist of the Month (only reviews tied to a specific Performance count)
    const artistAgg = new Map<string, { count: number; sum: number; artistId: string; name: string; avatar: string | null }>()
    for (const r of reviews) {
      if (!r.performance?.artistId) continue
      const a = r.performance.artist
      const existing = artistAgg.get(a.id)
      if (existing) {
        existing.count += 1
        existing.sum += r.rating
      } else {
        artistAgg.set(a.id, { count: 1, sum: r.rating, artistId: a.id, name: a.user.displayName ?? a.user.name, avatar: a.user.avatar })
      }
    }
    let artistOfMonth: { id: string; name: string; avatar: string | null; avgRating: number; reviewCount: number } | null = null
    for (const { count, sum, artistId, name, avatar } of artistAgg.values()) {
      if (count < MIN_REVIEWS) continue
      const avg = sum / count
      if (!artistOfMonth || avg > artistOfMonth.avgRating || (avg === artistOfMonth.avgRating && count > artistOfMonth.reviewCount)) {
        artistOfMonth = { id: artistId, name, avatar, avgRating: avg, reviewCount: count }
      }
    }

    // Top Venues / Top Organisers — all-time, separate query (the
    // monthly `reviews` fetch above only covers the current month).
    const allTimeReviews = await prisma.review.findMany({
      select: {
        rating: true,
        event: {
          select: {
            organiserId: true,
            organiser: { select: { orgName: true } },
            venueId: true,
            venue: { select: { name: true } },
          },
        },
      },
    })

    const organiserAgg = new Map<string, { count: number; sum: number; name: string }>()
    const venueAgg = new Map<string, { count: number; sum: number; name: string }>()
    for (const r of allTimeReviews) {
      const oId = r.event.organiserId
      const oExisting = organiserAgg.get(oId)
      if (oExisting) {
        oExisting.count += 1
        oExisting.sum += r.rating
      } else {
        organiserAgg.set(oId, { count: 1, sum: r.rating, name: r.event.organiser.orgName })
      }

      if (r.event.venueId && r.event.venue) {
        const vExisting = venueAgg.get(r.event.venueId)
        if (vExisting) {
          vExisting.count += 1
          vExisting.sum += r.rating
        } else {
          venueAgg.set(r.event.venueId, { count: 1, sum: r.rating, name: r.event.venue.name })
        }
      }
    }

    const rankLeaderboard = (agg: Map<string, { count: number; sum: number; name: string }>) =>
      Array.from(agg.entries())
        .map(([id, { count, sum, name }]) => ({ id, name, avgRating: sum / count, reviewCount: count }))
        .filter((e) => e.reviewCount >= MIN_REVIEWS)
        .sort((a, b) => b.avgRating - a.avgRating || b.reviewCount - a.reviewCount)
        .slice(0, LEADERBOARD_SIZE)

    const topOrganisers = rankLeaderboard(organiserAgg)
    const topVenues = rankLeaderboard(venueAgg)

    return NextResponse.json({ month: monthLabel, artistOfMonth, eventOfMonth, topOrganisers, topVenues, minReviews: MIN_REVIEWS })
  } catch (err) {
    console.error('Error computing wall of fame:', err)
    return NextResponse.json({ error: 'Failed to compute wall of fame' }, { status: 500 })
  }
}
