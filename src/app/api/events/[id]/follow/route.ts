import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getFollowStatus, toggleFollow } from '@/lib/follow'

// Mobile Redesign Phase 4b (GEN-2609-007) - Saved/wishlist, mirrors the
// existing artists/[id]/follow, venues/[id]/follow, organisers/[id]/follow
// routes exactly (same GET/POST shape). No PATCH (notify-bell toggle) -
// the Figma v2 export's Saved screen has no per-event notification
// preference, only save/unsave, so that's all this route needs.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  const userId = session?.user ? (session.user as any).id : null
  const result = await getFollowStatus(userId, 'EVENT', id)
  return NextResponse.json(result)
}

// Toggle - saves if not already saved, unsaves if already saved.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const event = await prisma.event.findUnique({ where: { id } })
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const result = await toggleFollow((session.user as any).id, 'EVENT', id)
  return NextResponse.json(result)
}
