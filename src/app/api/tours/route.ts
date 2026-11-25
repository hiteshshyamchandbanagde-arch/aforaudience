import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { generateUniqueTourSlug } from '@/lib/tours'

// POST /api/tours
// body: { title: string, subject?: string }
//
// Tour by Organiser (12 Aug). Creates the Tour shell only - stops are
// added afterward via POST /api/events with tourId set, and lineup per
// stop via POST /api/events/[id]/tour-lineup. Starts DRAFT; status is
// recomputed automatically as consents/stops change (see lib/tours.ts).
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user || user.role !== 'ORGANISER') {
      return NextResponse.json({ error: 'Only organisers can create a Tour' }, { status: 403 })
    }

    const organiser = await prisma.organiser.findUnique({ where: { userId: user.id } })
    if (!organiser) {
      return NextResponse.json({ error: 'Organiser profile not found' }, { status: 404 })
    }
    if (!organiser.isApproved) {
      return NextResponse.json({ error: 'Your Organiser account is still pending approval' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 500) : null

    if (!title) {
      return NextResponse.json({ error: 'Tour title is required' }, { status: 400 })
    }
    if (title.length > 120) {
      return NextResponse.json({ error: 'Tour title must be 120 characters or fewer' }, { status: 400 })
    }

    const slug = await generateUniqueTourSlug(title)

    const tour = await prisma.tour.create({
      data: {
        organiserId: organiser.id,
        title,
        subject,
        slug,
      },
    })

    return NextResponse.json({ tour }, { status: 201 })
  } catch (err) {
    console.error('[tours POST] error:', err)
    return NextResponse.json({ error: 'Failed to create Tour' }, { status: 500 })
  }
}
