import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const artists = await prisma.artist.findMany({
      include: {
        user: { select: { name: true, avatar: true } },
        _count: { select: { performances: true } },
      },
      // hypScore (profile-level, always 0, never written) retired as part
      // of the reputation epic - real per-show Hype Score now lives on
      // Performance/event pages, not here. Sorting falls back to gig
      // count until Scene Status (§1 of the reputation design) ships and
      // becomes the real "who's trending" signal.
      orderBy: { performances: { _count: 'desc' } },
    })

    return NextResponse.json(artists)
  } catch (err) {
    console.error('Error fetching artists:', err)
    return NextResponse.json({ error: 'Failed to fetch artists' }, { status: 500 })
  }
}
