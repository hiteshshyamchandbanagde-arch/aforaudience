import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// G2 - rate a performer post-show. Not restricted to confirmed/attended
// bookings - there's no check-in/attendance-verification system yet, so
// this just requires being logged in, same as every other gated action.
// Worth tightening once ticket check-in exists.
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventId, performanceId, rating, comment } = await req.json()

    if (!eventId || !rating || Number(rating) < 1 || Number(rating) > 5) {
      return NextResponse.json({ error: 'A rating from 1 to 5 is required' }, { status: 400 })
    }

    const existing = await prisma.review.findFirst({
      where: { userId: user.id, eventId, performanceId: performanceId || null },
    })
    if (existing) {
      return NextResponse.json({ error: "You've already reviewed this performer for this event" }, { status: 409 })
    }

    const review = await prisma.review.create({
      data: {
        userId: user.id,
        eventId,
        performanceId: performanceId || null,
        rating: Number(rating),
        comment: comment?.trim() || null,
      },
    })

    return NextResponse.json(review, { status: 201 })
  } catch (err) {
    console.error('Error creating review:', err)
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 })
  }
}
