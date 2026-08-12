import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/tours/[slug] - public Tour landing page. Deliberately only
// ever returns APPROVED/COMPLETED stops (same visibility rule as the
// public events listing, GET /api/events) - a DRAFT/PENDING_APPROVAL
// stop waiting on artist consent is an internal management detail, not
// something an audience member should see or be able to book.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params

    const tour = await prisma.tour.findUnique({
      where: { slug },
      include: {
        organiser: { select: { orgName: true, id: true } },
        stops: {
          where: { status: { in: ['APPROVED', 'COMPLETED'] } },
          include: {
            venue: { select: { name: true, city: true } },
            lineup: {
              where: { cancelledAt: null },
              include: { artist: { include: { user: { select: { name: true, displayName: true } } } } },
              orderBy: { slot: 'asc' },
            },
          },
          orderBy: { date: 'asc' },
        },
      },
    })

    if (!tour || tour.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Tour not found' }, { status: 404 })
    }

    return NextResponse.json({ tour })
  } catch (err) {
    console.error('[tours/[slug] GET] error:', err)
    return NextResponse.json({ error: 'Failed to load Tour' }, { status: 500 })
  }
}

// PATCH /api/tours/[slug] - organiser (owner) only. Edits title/subject,
// or cancels the Tour (status: 'CANCELLED'). Does not let the organiser
// hand-set DRAFT/PENDING_CONSENT/LIVE directly - those are always
// computed (see lib/tours.ts recomputeTourStatus), only CANCELLED is a
// deliberate manual action here.
export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const tour = await prisma.tour.findUnique({ where: { slug } })
    if (!tour) {
      return NextResponse.json({ error: 'Tour not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN') {
      const organiser = await prisma.organiser.findUnique({ where: { id: tour.organiserId } })
      if (!organiser || organiser.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const body = await req.json().catch(() => ({}))
    const data: { title?: string; subject?: string | null; status?: 'CANCELLED' } = {}

    if (body.title !== undefined) {
      const title = String(body.title).trim()
      if (!title || title.length > 120) {
        return NextResponse.json({ error: 'Tour title must be 1-120 characters' }, { status: 400 })
      }
      data.title = title
    }
    if (body.subject !== undefined) {
      data.subject = body.subject ? String(body.subject).trim().slice(0, 500) : null
    }
    if (body.cancel === true) {
      data.status = 'CANCELLED'
    }

    const updated = await prisma.tour.update({ where: { id: tour.id }, data })
    return NextResponse.json({ tour: updated })
  } catch (err) {
    console.error('[tours/[slug] PATCH] error:', err)
    return NextResponse.json({ error: 'Failed to update Tour' }, { status: 500 })
  }
}
