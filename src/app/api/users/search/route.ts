import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/users/search?q=...
//
// Companion Tagging Phase 1 (reputation epic §7) - lets a booker find a
// real AFA account to tag by handle/display name at checkout. `name` is
// the unique login username (see User model comment), so this is a
// straightforward handle search, not a fuzzy people-search feature.
//
// Auth-gated (any logged-in role can search - a booker tagging a friend
// doesn't require any particular role) purely to avoid an unauthenticated
// user-enumeration endpoint. Excludes the caller themselves. Capped at 8
// results and a 2-char minimum query - this is a type-ahead, not a
// browsable directory.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  if (q.length < 2) {
    return NextResponse.json({ users: [] })
  }

  const selfId = (session.user as any).id

  const users = await prisma.user.findMany({
    where: {
      id: { not: selfId },
      isSuspended: false,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, displayName: true, avatar: true },
    take: 8,
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ users })
}
