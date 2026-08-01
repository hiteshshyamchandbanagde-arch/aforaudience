import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getVotingWindow, computeAudienceChoiceResults } from '@/lib/competition-voting'

// GET /api/events/[id]/vote/results — public, no auth required. Gated
// until the voting window actually closes ("Results are public
// immediately on close" per the design doc - not before, not a
// live-updating leaderboard while voting is still in progress, which
// would let later voters see and react to the current standings).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, date: true, startTime: true, endTime: true, isCompetitionShow: true, status: true },
  })
  if (!event || event.status !== 'APPROVED') {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }
  if (!event.isCompetitionShow) {
    return NextResponse.json({ error: 'This event is not a competition show' }, { status: 400 })
  }

  const window = getVotingWindow(event)
  if (!window.isClosed) {
    return NextResponse.json({
      available: false,
      votingOpensAt: window.opensAt,
      votingClosesAt: window.closesAt,
      isOpen: window.isOpen,
    })
  }

  const results = await computeAudienceChoiceResults(eventId)
  return NextResponse.json({ available: true, ...results })
}
