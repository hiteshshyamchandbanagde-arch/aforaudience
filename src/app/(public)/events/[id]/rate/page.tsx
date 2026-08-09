import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import RatePromptClientPage from './RatePromptClientPage'

// GEN-2608-027 - same eventStartInstant convention used in
// bookings/[id]/route.ts, performances/[id]/cancel/route.ts, and
// api/reviews/route.ts (the real server-side gate this mirrors).
function eventStartInstant(date: Date, startTime: string): Date {
  const [h, m] = startTime.split(':').map(Number)
  const start = new Date(date)
  start.setHours(h, m, 0, 0)
  return start
}

// Reputation epic §5 - dedicated landing page for the post-show rating
// prompt push. Deliberately separate from the main event page: this is
// meant to be a focused "rate the show" moment when someone taps the
// notification, not a re-browse of the event. Per-performer rating
// still lives inline on the event page too (unchanged) - this page adds
// the overall/required-feeling rating §5 calls for, plus a quick path
// into the optional per-performer ratings for anyone who arrived here
// from the push.
export default async function RatePromptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      date: true,
      startTime: true,
      posterImage: true,
      lineup: {
        select: { id: true, artist: { select: { id: true, user: { select: { name: true, displayName: true } } } } },
        orderBy: { slot: 'asc' },
      },
    },
  })

  if (!event) {
    return <RatePromptClientPage event={null} canReview={false} existingOverallRating={null} ratedPerformanceIds={[]} />
  }

  let canReview = false
  let existingOverallRating: { rating: number; comment: string | null } | null = null
  let ratedPerformanceIds: string[] = []

  if (session?.user) {
    const userId = (session.user as any).id
    const [checkedInBooking, myReviews] = await Promise.all([
      prisma.booking.findFirst({
        where: { userId, eventId: id, status: 'CONFIRMED', checkedInAt: { not: null } },
        select: { id: true },
      }),
      prisma.review.findMany({
        where: { userId, eventId: id },
        select: { performanceId: true, rating: true, comment: true },
      }),
    ])
    canReview = !!checkedInBooking && eventStartInstant(event.date, event.startTime).getTime() <= Date.now()
    type ReviewRow = { performanceId: string | null; rating: number; comment: string | null }
    const overall = (myReviews as ReviewRow[]).find((r) => r.performanceId === null)
    existingOverallRating = overall ? { rating: overall.rating, comment: overall.comment } : null
    ratedPerformanceIds = (myReviews as ReviewRow[]).filter((r) => r.performanceId).map((r) => r.performanceId as string)
  }

  return (
    <RatePromptClientPage
      event={JSON.parse(JSON.stringify(event))}
      canReview={canReview}
      existingOverallRating={existingOverallRating}
      ratedPerformanceIds={ratedPerformanceIds}
    />
  )
}

export const dynamic = 'force-dynamic'
