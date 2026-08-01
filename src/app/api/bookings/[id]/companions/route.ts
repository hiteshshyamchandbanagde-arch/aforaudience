import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser } from '@/lib/push'

// Companion Tagging Phase 1 (reputation epic §7) - GET lists the current
// booker's companion tags for this booking; PATCH sets consent and/or
// adds new tags. Both are owner-only (or admin) - same guard pattern as
// GET /api/bookings/[id].
//
// Deliberately no PATCH-to-remove-consent here: revoking consent after
// tags already exist is a real question (do existing ACCEPTED tags stay
// counted?) that isn't answered by the design doc yet - out of scope for
// this phase, field exists for later.

async function requireOwner(bookingId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const userId = (session.user as any).id
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
  if (!booking) return { error: NextResponse.json({ error: 'Booking not found' }, { status: 404 }) }
  if (booking.userId !== user.id && user.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, booking }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requireOwner(id)
  if (guard.error) return guard.error

  const tags = await prisma.companionTag.findMany({
    where: { bookingId: id },
    include: { taggedUser: { select: { id: true, name: true, displayName: true, avatar: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    companionTaggingConsent: guard.booking!.companionTaggingConsent,
    tags,
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requireOwner(id)
  if (guard.error) return guard.error
  const { user, booking } = guard as { user: any; booking: any }

  const body = await req.json().catch(() => ({}))
  const consent: boolean | undefined = typeof body.consent === 'boolean' ? body.consent : undefined
  const addUserIds: string[] = Array.isArray(body.addUserIds) ? body.addUserIds.filter((x: any) => typeof x === 'string') : []

  // Can't tag anyone without consent already true (either passed in this
  // same request or already set from a prior one) - this is the
  // enforcement point for "consent gates tagging", not just a UI nicety.
  const consentNow = consent ?? booking.companionTaggingConsent
  if (addUserIds.length > 0 && !consentNow) {
    return NextResponse.json({ error: 'Consent is required before tagging companions' }, { status: 400 })
  }
  if (addUserIds.includes(user.id)) {
    return NextResponse.json({ error: "You can't tag yourself" }, { status: 400 })
  }

  const updateData: any = {}
  if (consent !== undefined) {
    updateData.companionTaggingConsent = consent
    updateData.companionTaggingConsentAt = consent ? new Date() : booking.companionTaggingConsentAt
  }

  await prisma.$transaction([
    ...(Object.keys(updateData).length > 0 ? [prisma.booking.update({ where: { id }, data: updateData })] : []),
    ...addUserIds.map((taggedUserId: string) =>
      prisma.companionTag.upsert({
        where: { bookingId_taggedUserId: { bookingId: id, taggedUserId } },
        update: {},
        create: { bookingId: id, taggedByUserId: user.id, taggedUserId },
      })
    ),
  ])

  // Notify newly-tagged users. Best-effort, same "don't fail the request
  // over a push" pattern as the post-show rating cron. Pushes fire for
  // every id in addUserIds regardless of whether the upsert created or
  // matched an existing tag - re-tagging someone who's already PENDING
  // re-notifying them is an acceptable false-positive, simpler than
  // tracking which upserts were actually inserts.
  const taggerName = user.displayName || user.name
  await Promise.all(
    addUserIds.map((taggedUserId: string) =>
      sendPushToUser(taggedUserId, {
        title: "You've been tagged",
        body: `${taggerName} tagged you as their companion for an upcoming show. Confirm on your Tickets page.`,
        url: '/tickets',
      })
    )
  )

  const tags = await prisma.companionTag.findMany({
    where: { bookingId: id },
    include: { taggedUser: { select: { id: true, name: true, displayName: true, avatar: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    companionTaggingConsent: consent ?? booking.companionTaggingConsent,
    tags,
  })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requireOwner(id)
  if (guard.error) return guard.error

  const { searchParams } = new URL(req.url)
  const tagId = searchParams.get('tagId')
  if (!tagId) {
    return NextResponse.json({ error: 'tagId is required' }, { status: 400 })
  }

  const tag = await prisma.companionTag.findUnique({ where: { id: tagId } })
  if (!tag || tag.bookingId !== id) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
  }

  await prisma.companionTag.delete({ where: { id: tagId } })
  return NextResponse.json({ ok: true })
}
