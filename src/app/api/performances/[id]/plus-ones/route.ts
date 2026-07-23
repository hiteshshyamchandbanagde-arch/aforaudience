import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { requireVerifiedPhone } from '@/lib/verification'
import { getPlusOneStatus, confirmPlusOne } from '@/lib/plus-one'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  const userId = session?.user ? (session.user as any).id : null

  const status = await getPlusOneStatus(userId, id)
  if (!status) {
    return NextResponse.json({ error: 'Performance not found' }, { status: 404 })
  }
  return NextResponse.json(status)
}

// Confirm - a binding-ish pledge to actually show up for a specific artist.
// Same verification bar as booking/venue-publish/offer-acceptance - this is
// a real commitment another person (the artist) relies on.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const verifyError = requireVerifiedPhone(user, 'confirming as a +1')
  if (verifyError) return verifyError

  const outcome = await confirmPlusOne(user.id, id)
  if ('error' in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status })
  }
  return NextResponse.json(outcome.result)
}
