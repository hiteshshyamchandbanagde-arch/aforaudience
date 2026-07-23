import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Multi-role support - mirrors /api/organisers/apply's reasoning (only
// ADMIN excluded; role only auto-flips for true first-timers). Artist
// itself has no Admin-approval gate ("goes live immediately"), but even
// so, a second-role application here deliberately does NOT auto-switch
// the active role either - staying consistent with Organiser/Venue Owner
// means applying can never silently kick someone out of whatever
// dashboard they're currently using. They switch explicitly afterward via
// POST /api/users/me/switch-role, same as the other two roles.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.role === 'ADMIN') {
    return NextResponse.json({ error: "Admin accounts can't apply for a second role." }, { status: 400 })
  }

  const existing = await prisma.artist.findUnique({ where: { userId: user.id } })
  if (existing) {
    return NextResponse.json({ error: 'You already have an Artist account.' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const genre = typeof body?.genre === 'string'
    ? body.genre.split(',').map((g: string) => g.trim()).filter(Boolean)
    : []

  const isFirstRole = user.role === 'AUDIENCE'

  await prisma.$transaction([
    ...(isFirstRole ? [prisma.user.update({ where: { id: user.id }, data: { role: 'ARTIST' as const } })] : []),
    prisma.artist.create({ data: { userId: user.id, genre, styleTag: [], videoReel: [] } }),
  ])

  return NextResponse.json({
    message: isFirstRole
      ? "You're all set — your Artist profile is live. Head to your dashboard to fill in the rest and start applying to events."
      : "Your Artist profile is live. Switch to it from your Profile whenever you're ready - your current account stays exactly as it is until then.",
  })
}
