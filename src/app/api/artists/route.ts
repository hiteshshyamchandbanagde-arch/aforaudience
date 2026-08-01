import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSceneStatusBatch } from '@/lib/scene-status'

export async function GET() {
  try {
    const artists = await prisma.artist.findMany({
      include: {
        user: { select: { name: true, avatar: true } },
        _count: { select: { performances: true } },
      },
      // hypScore (profile-level, always 0, never written) retired as part
      // of the reputation epic - real per-show Hype Score now lives on
      // Performance/event pages, not here. DB-level ordering still falls
      // back to gig count (Prisma can't order by a live-computed field),
      // but Scene Status is now attached below and used client-side for
      // the "Top Artist Right Now" pick and the card badge - the
      // placeholder this comment used to describe has shipped.
      orderBy: { performances: { _count: 'desc' } },
    })

    const sceneStatusById = await getSceneStatusBatch(artists.map((a: { id: string }) => a.id))
    const withSceneStatus = artists.map((a: (typeof artists)[number]) => ({
      ...a,
      sceneStatus: sceneStatusById.get(a.id) ?? 'NEW_EMERGING',
    }))

    return NextResponse.json(withSceneStatus)
  } catch (err) {
    console.error('Error fetching artists:', err)
    return NextResponse.json({ error: 'Failed to fetch artists' }, { status: 500 })
  }
}
