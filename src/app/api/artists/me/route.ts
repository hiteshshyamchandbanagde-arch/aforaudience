import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logNewGenreRequests } from '@/lib/genre-requests'

// Simple length caps, consistent with other free-text fields in this
// codebase (displayName 120, review comment 500) - generous enough
// for real storytelling, not unbounded.
const capped = (v: any, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) || null : undefined)

// FEAT-2608-047 - tour stop links can point anywhere (Instagram, a
// ticketing page, another platform's event listing), so no domain
// allowlist like isValidMapsUrl - just a real http(s) URL, blocking
// javascript:/data: and other schemes that shouldn't render as a
// clickable link on a public profile.
function isValidHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user || user.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const artist = await prisma.artist.findUnique({
      where: { userId: user.id },
      include: {
        applications: {
          include: { event: { include: { venue: true, organiser: true } } },
          orderBy: { createdAt: 'desc' },
        },
        performances: {
          include: {
            event: { include: { venue: true } },
            reviews: {
              include: {
                user: { select: { name: true, displayName: true } },
                reply: { include: { author: { select: { name: true, displayName: true } } } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        // FEAT-2608-047 - own tour list, most recent date first so the
        // artist sees their next stop at the top when editing.
        tourStops: { orderBy: { date: 'asc' } },
      },
    })

    if (!artist) {
      return NextResponse.json({ error: 'Artist profile not found' }, { status: 404 })
    }

    // Follow is now polymorphic (no direct Artist.followers relation to
    // include above) - fetched separately, same shape as before so this
    // response doesn't change for whatever consumes it.
    const followers = await prisma.follow.findMany({
      where: { targetType: 'ARTIST', targetId: artist.id },
      include: { user: { select: { name: true, displayName: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ ...artist, followers, name: user.name, displayName: user.displayName, email: user.email })
  } catch (err) {
    console.error('Error fetching artist profile:', err)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user || user.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const artist = await prisma.artist.findUnique({ where: { userId: user.id } })
    if (!artist) {
      return NextResponse.json({ error: 'Artist profile not found' }, { status: 404 })
    }

    const body = await req.json()
    const { bio, genre, styleTag, socialLinks, tagline, fullBiography, journey, influences, acknowledgments, goals, tourStops } = body

    // FEAT-2608-047 - tour stops are informational only (not tied to a
    // real AFA booking), so kept deliberately lightweight: city/country
    // required, date/link optional. Malformed rows (missing city or
    // country, or a link that isn't a real http(s) URL) are dropped
    // rather than rejecting the whole save - an artist mid-editing a
    // form shouldn't lose every other valid row over one incomplete one.
    const validTourStops = Array.isArray(tourStops)
      ? tourStops
          .filter((t: any) => t && typeof t.city === 'string' && t.city.trim() && typeof t.country === 'string' && t.country.trim())
          .map((t: any) => {
            const parsedDate = t.date ? new Date(t.date) : null
            return {
              city: String(t.city).trim().slice(0, 100),
              country: String(t.country).trim().slice(0, 100),
              date: parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null,
              link: t.link && typeof t.link === 'string' && isValidHttpUrl(t.link) ? String(t.link).trim().slice(0, 500) : null,
            }
          })
      : undefined

    const updated = await prisma.artist.update({
      where: { id: artist.id },
      data: {
        ...(bio !== undefined && { bio }),
        ...(Array.isArray(genre) && { genre }),
        ...(Array.isArray(styleTag) && { styleTag }),
        ...(socialLinks !== undefined && { socialLinks }),
        ...(tagline !== undefined && { tagline: capped(tagline, 200) }),
        ...(fullBiography !== undefined && { fullBiography: capped(fullBiography, 5000) }),
        ...(journey !== undefined && { journey: capped(journey, 5000) }),
        ...(influences !== undefined && { influences: capped(influences, 2000) }),
        ...(acknowledgments !== undefined && { acknowledgments: capped(acknowledgments, 2000) }),
        ...(goals !== undefined && { goals: capped(goals, 2000) }),
        // Full-replace, same semantics as Event.ticketTiers - the client
        // always sends the complete current list, not a diff.
        ...(validTourStops !== undefined && {
          tourStops: {
            deleteMany: {},
            create: validTourStops,
          },
        }),
      },
      include: { tourStops: { orderBy: { date: 'asc' } } },
    })

    if (Array.isArray(genre)) await logNewGenreRequests(genre)

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Error updating artist profile:', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
