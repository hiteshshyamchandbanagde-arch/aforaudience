import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET/PATCH /api/venue-owners/me - session 62 addition, same shape as
// /api/organisers/me. VenueOwner previously had no editable fields of its
// own at all (bio didn't exist until this session) - this is the first
// self-edit route for this role.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const venueOwner = await prisma.venueOwner.findUnique({
    where: { userId: (session.user as any).id },
  })
  if (!venueOwner) {
    return NextResponse.json({ error: 'Venue Owner profile not found' }, { status: 404 })
  }
  return NextResponse.json({ id: venueOwner.id, bio: venueOwner.bio })
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const venueOwner = await prisma.venueOwner.findUnique({
      where: { userId: (session.user as any).id },
    })
    if (!venueOwner) {
      return NextResponse.json({ error: 'Venue Owner profile not found' }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

    if (!Object.prototype.hasOwnProperty.call(body, 'bio')) {
      return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
    }

    const raw = body.bio
    let bio: string | null
    if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
      bio = null
    } else if (typeof raw === 'string') {
      bio = raw.trim().slice(0, 1000)
    } else {
      return NextResponse.json({ error: 'bio must be a string or null' }, { status: 400 })
    }

    const updated = await prisma.venueOwner.update({ where: { id: venueOwner.id }, data: { bio } })
    return NextResponse.json({ id: updated.id, bio: updated.bio })
  } catch (err) {
    console.error('Error updating venue owner profile:', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
