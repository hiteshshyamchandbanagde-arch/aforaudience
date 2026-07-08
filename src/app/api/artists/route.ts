import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const artists = await prisma.artist.findMany({
      include: {
        user: { select: { name: true, avatar: true } },
        _count: { select: { performances: true } },
      },
      orderBy: { hypScore: 'desc' },
    })

    return NextResponse.json(artists)
  } catch (err) {
    console.error('Error fetching artists:', err)
    return NextResponse.json({ error: 'Failed to fetch artists' }, { status: 500 })
  }
}
