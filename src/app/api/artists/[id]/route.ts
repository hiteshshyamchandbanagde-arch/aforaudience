import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const artist = await prisma.artist.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, avatar: true } },
        performances: {
          include: { event: { include: { venue: true } } },
        },
        _count: { select: { performances: true } },
      },
    })

    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }

    return NextResponse.json(artist)
  } catch (err) {
    console.error('Error fetching artist:', err)
    return NextResponse.json({ error: 'Failed to fetch artist' }, { status: 500 })
  }
}
