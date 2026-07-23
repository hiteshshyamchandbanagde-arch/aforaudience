import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

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

    return NextResponse.json({ ...artist, followers, name: user.name, email: user.email })
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
    const { bio, genre, styleTag, socialLinks, tagline, fullBiography, journey, influences, acknowledgments, goals } = body

    // Simple length caps, consistent with other free-text fields in this
    // codebase (displayName 120, review comment 500) - generous enough
    // for real storytelling, not unbounded.
    const capped = (v: any, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) || null : undefined)

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
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Error updating artist profile:', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
