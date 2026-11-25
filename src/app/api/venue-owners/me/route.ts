import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { parseUpiId, parseUpiQrUrl } from '@/lib/venue-direct-pay'

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
  return NextResponse.json({ id: venueOwner.id, bio: venueOwner.bio, upiId: venueOwner.upiId, upiQrUrl: venueOwner.upiQrUrl })
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

    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)
    if (!has('bio') && !has('upiId') && !has('upiQrUrl')) {
      return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
    }

    const data: { bio?: string | null; upiId?: string | null; upiQrUrl?: string | null } = {}
    if (has('bio')) {
      const raw = body.bio
      if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
        data.bio = null
      } else if (typeof raw === 'string') {
        data.bio = raw.trim().slice(0, 1000)
      } else {
        return NextResponse.json({ error: 'bio must be a string or null' }, { status: 400 })
      }
    }
    // D2 - where organisers pay this owner directly for venue hire.
    if (has('upiId')) {
      const upi = parseUpiId(body.upiId)
      if (!upi.ok) return NextResponse.json({ error: upi.error }, { status: 400 })
      data.upiId = upi.value
    }
    // D2b - optional UPI QR image (uploaded via /api/upload/avatar).
    if (has('upiQrUrl')) {
      const qr = parseUpiQrUrl(body.upiQrUrl)
      if (!qr.ok) return NextResponse.json({ error: qr.error }, { status: 400 })
      data.upiQrUrl = qr.value
    }

    const updated = await prisma.venueOwner.update({ where: { id: venueOwner.id }, data })
    return NextResponse.json({ id: updated.id, bio: updated.bio, upiId: updated.upiId, upiQrUrl: updated.upiQrUrl })
  } catch (err) {
    console.error('Error updating venue owner profile:', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
