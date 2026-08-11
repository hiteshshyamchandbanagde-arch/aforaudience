import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

const VALID_STATUSES = ['NEW', 'CONTACTED', 'CLOSED']

// Status update only (Mark Contacted / Close) - artist can only touch
// their own inquiries, same ownership-check pattern as
// PATCH /api/applications/[id].
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user || user.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const artist = await prisma.artist.findUnique({ where: { userId: user.id } })
    if (!artist) {
      return NextResponse.json({ error: 'Artist profile not found' }, { status: 404 })
    }

    const body = await req.json()
    const { status } = body
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const inquiry = await prisma.corporateBookingInquiry.findUnique({ where: { id } })
    if (!inquiry || inquiry.artistId !== artist.id) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 })
    }

    const updated = await prisma.corporateBookingInquiry.update({
      where: { id },
      data: { status },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[corporate-inquiries PATCH] error:', err)
    return NextResponse.json({ error: 'Failed to update inquiry' }, { status: 500 })
  }
}
