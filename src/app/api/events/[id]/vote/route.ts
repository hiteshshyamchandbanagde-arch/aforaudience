import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getVotingWindow, getVoterEligibility, type VoterCategory } from '@/lib/competition-voting'

// GET /api/events/[id]/vote — the current user's ballot state: which
// category (or categories) they're eligible to vote in, the lineup to
// rank, whether voting is currently open, and any votes they've already
// cast (so the client can pre-fill/show "you voted" rather than a blank
// form).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id
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
  const eligibility = await getVoterEligibility(eventId, userId)

  const lineup = await prisma.performance.findMany({
    where: { eventId, cancelledAt: null },
    select: { id: true, artist: { select: { user: { select: { name: true, displayName: true } } } } },
    orderBy: { slot: 'asc' },
  })
  const lineupForClient = (lineup as { id: string; artist: { user: { name: string; displayName: string | null } } }[]).map((p) => ({ id: p.id, artistName: p.artist.user.displayName || p.artist.user.name }))

  // For each category the user is eligible in, fetch their existing votes
  // (keyed by the relevant voterId for that category) so the client can
  // show what they already cast.
  const myVotes: Partial<Record<VoterCategory, { performanceId: string; rank: number; voterId?: string }[]>> = {}
  if (eligibility.isPanelist) {
    myVotes.PANELIST = await prisma.competitionVote.findMany({
      where: { eventId, category: 'PANELIST', voterId: userId },
      select: { performanceId: true, rank: true },
    })
  }
  if (eligibility.isCelebrity) {
    myVotes.CELEBRITY = await prisma.competitionVote.findMany({
      where: { eventId, category: 'CELEBRITY', voterId: userId },
      select: { performanceId: true, rank: true },
    })
  }
  if (eligibility.audienceBookingIds.length > 0) {
    myVotes.AUDIENCE = await prisma.competitionVote.findMany({
      where: { eventId, category: 'AUDIENCE', voterId: { in: eligibility.audienceBookingIds } },
      select: { performanceId: true, rank: true, voterId: true },
    })
  }

  return NextResponse.json({
    lineup: lineupForClient,
    votingOpensAt: window.opensAt,
    votingClosesAt: window.closesAt,
    isOpen: window.isOpen,
    isClosed: window.isClosed,
    eligibility,
    myVotes,
  })
}

// POST /api/events/[id]/vote
// body: { category: 'AUDIENCE'|'PANELIST'|'CELEBRITY', bookingId?: string (required for AUDIENCE), rankings: [{ performanceId, rank }] }
//
// rankings: 1-3 entries, ranks must be a subset of {1,2,3} with no
// duplicates, performanceIds must be in this event's active lineup and
// not repeated. Full-replace semantics per category+voter (delete then
// recreate in one transaction) - lets someone revise their ballot any
// time before the window closes, same "resubmit to change your mind"
// convention as other rankable/settable state in this codebase.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id
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
    if (!window.isOpen) {
      return NextResponse.json(
        { error: window.isClosed ? 'Voting has closed for this event' : 'Voting has not opened yet — it opens once the show ends' },
        { status: 409 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const category = body.category as VoterCategory
    if (!['AUDIENCE', 'PANELIST', 'CELEBRITY'].includes(category)) {
      return NextResponse.json({ error: 'category must be AUDIENCE, PANELIST, or CELEBRITY' }, { status: 400 })
    }

    const rankings = body.rankings
    if (!Array.isArray(rankings) || rankings.length < 1 || rankings.length > 3) {
      return NextResponse.json({ error: 'rankings must be an array of 1-3 entries' }, { status: 400 })
    }
    const ranks = rankings.map((r: any) => r.rank)
    const performanceIds = rankings.map((r: any) => r.performanceId)
    if (new Set(ranks).size !== ranks.length || ranks.some((r: any) => ![1, 2, 3].includes(r))) {
      return NextResponse.json({ error: 'Each rank must be a unique value from 1, 2, 3' }, { status: 400 })
    }
    if (new Set(performanceIds).size !== performanceIds.length) {
      return NextResponse.json({ error: 'Cannot rank the same performer twice' }, { status: 400 })
    }

    const validPerformances = await prisma.performance.findMany({
      where: { id: { in: performanceIds }, eventId, cancelledAt: null },
      select: { id: true },
    })
    if (validPerformances.length !== performanceIds.length) {
      return NextResponse.json({ error: 'One or more performers are not in this event\'s active lineup' }, { status: 400 })
    }

    // Determine voterId for this category - the actual identity check
    // (does this user really qualify) happens here, not trusted from the
    // client.
    let voterId: string
    if (category === 'PANELIST') {
      const entry = await prisma.eventPanelist.findFirst({ where: { eventId, userId, status: 'ACCEPTED' } })
      if (!entry) return NextResponse.json({ error: 'You are not an accepted panelist for this event' }, { status: 403 })
      voterId = userId
    } else if (category === 'CELEBRITY') {
      const entry = await prisma.celebrity.findFirst({ where: { eventId, userId, status: 'ACCEPTED' } })
      if (!entry) return NextResponse.json({ error: 'You are not an accepted celebrity guest for this event' }, { status: 403 })
      voterId = userId
    } else {
      const bookingId = body.bookingId
      if (typeof bookingId !== 'string') {
        return NextResponse.json({ error: 'bookingId is required for an AUDIENCE vote' }, { status: 400 })
      }
      const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
      if (!booking || booking.eventId !== eventId || booking.userId !== userId || booking.status !== 'CONFIRMED' || !booking.checkedInAt) {
        return NextResponse.json({ error: 'That booking is not an eligible, checked-in booking for this event' }, { status: 403 })
      }
      voterId = bookingId
    }

    await prisma.$transaction([
      prisma.competitionVote.deleteMany({ where: { eventId, category, voterId } }),
      prisma.competitionVote.createMany({
        data: rankings.map((r: { performanceId: string; rank: number }) => ({
          eventId,
          category,
          voterId,
          performanceId: r.performanceId,
          rank: r.rank,
        })),
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error casting vote:', err)
    return NextResponse.json({ error: 'Failed to cast vote' }, { status: 500 })
  }
}
