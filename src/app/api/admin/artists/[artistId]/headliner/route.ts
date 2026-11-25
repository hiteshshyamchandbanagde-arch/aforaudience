import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// PATCH /api/admin/artists/[artistId]/headliner — admin-only.
// Body: { headliner: boolean, note?: string }
//
// Headliner (reputation epic §1, amended session 55/56) is deliberately
// fully manual, no formula, no threshold - "not a small thing to get,
// it's supposed to be earned." The optional note is a lightweight audit
// trail of the admin's reasoning at the moment it's granted (session 56 -
// Hitesh's artist roster request), not required, never shown publicly.

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  return user?.role === 'ADMIN' ? user : null
}

export async function PATCH(req: Request, { params }: { params: Promise<{ artistId: string }> }) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { artistId } = await params

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (typeof body.headliner !== 'boolean') {
      return NextResponse.json({ error: 'headliner (boolean) is required' }, { status: 400 })
    }

    const artist = await prisma.artist.findUnique({ where: { id: artistId }, select: { id: true } })
    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }

    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : undefined

    const updated = await prisma.artist.update({
      where: { id: artistId },
      data: {
        isSceneStatusHeadliner: body.headliner,
        // Clearing Headliner clears the note too - a stale "why they're
        // Headliner" note lingering after the tag is removed would be
        // misleading if it's ever granted again later for a different
        // reason. Note is only ever written when granting.
        headlinerNote: body.headliner ? (note ?? undefined) : null,
      },
      select: { id: true, isSceneStatusHeadliner: true, headlinerNote: true },
    })

    return NextResponse.json({ artist: updated })
  } catch (err) {
    console.error('Error updating Headliner status:', err)
    return NextResponse.json({ error: 'Failed to update Headliner status' }, { status: 500 })
  }
}
