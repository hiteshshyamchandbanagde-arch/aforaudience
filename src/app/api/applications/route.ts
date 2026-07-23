import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'
import { requireVerifiedPhone } from '@/lib/verification'

export async function POST(req: Request) {
  try {
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
    const verifyError = requireVerifiedPhone(user, 'applying - the organiser is building their lineup on it')
    if (verifyError) return verifyError

    const body = await req.json()
    const { eventId, message } = body

    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
    }

    const event = await prisma.event.findUnique({ where: { id: eventId }, include: { organiser: true } })
    if (!event || event.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Event not found or not open for applications' }, { status: 404 })
    }

    const existing = await prisma.application.findFirst({
      where: { eventId, artistId: artist.id },
    })
    if (existing) {
      return NextResponse.json({ error: 'You already applied to this event' }, { status: 409 })
    }

    // §4.5 - respect the Organiser's max performer cap, if they set one.
    // A full lineup no longer hard-rejects the application outright -
    // it queues as WAITLISTED instead (Hitesh's own admin note, 22 Jul).
    // FCFS by createdAt. Promotion on a cancellation isn't wired up yet
    // (no cancellation mechanism exists in the app at all) - this ships
    // the queue itself; an Organiser can still manually approve a
    // waitlisted applicant the normal way if a slot frees up.
    let isWaitlisted = false
    if (event.maxPerformers !== null) {
      // cancelledAt: null - a cancelled slot no longer occupies a spot in
      // the lineup, otherwise a cancellation would permanently inflate
      // this count and every future applicant would be wrongly waitlisted
      // even when a real slot is open (see POST /api/performances/[id]/cancel,
      // which already excludes cancelled rows the same way).
      const filledSlots = await prisma.performance.count({ where: { eventId, cancelledAt: null } })
      if (filledSlots >= event.maxPerformers) {
        isWaitlisted = true
      }
    }

    // Auto-approval mode: with verification now required to even submit,
    // every applicant here is already verified - Auto just means the
    // Organiser doesn't want to manually review, so we skip straight to
    // approved as a FREE/exposure slot immediately. The Organiser can
    // still adjust compensation for them afterward from the event page -
    // there's no per-applicant compensation input at apply time, so Auto
    // can only default to Free, never Paid/Buy-in. Waitlisted applicants
    // never auto-approve, even in Auto mode - there's genuinely no slot.
    const shouldAutoApprove = event.applicationApprovalMode === 'AUTO' && !isWaitlisted

    const application = await prisma.application.create({
      data: {
        eventId,
        artistId: artist.id,
        message: message || '',
        status: isWaitlisted ? 'WAITLISTED' : shouldAutoApprove ? 'APPROVED' : 'PENDING',
      },
    })

    if (isWaitlisted) {
      const waitlistPosition = await prisma.application.count({
        where: { eventId, status: 'WAITLISTED', createdAt: { lt: application.createdAt } },
      })
      notifyAfterResponse(
        () =>
          sendPushToUser(user.id, {
            title: 'Added to waitlist',
            body: `"${event.title}"'s lineup is full - you're #${waitlistPosition + 1} on the waitlist.`,
            url: `/dashboard/artist/events`,
          }),
        'application-waitlisted'
      )
    } else if (shouldAutoApprove) {
      const lineupCount = await prisma.performance.count({ where: { eventId, cancelledAt: null } })
      await prisma.performance.create({
        data: { eventId, artistId: artist.id, slot: lineupCount + 1, duration: 10, compensationType: 'FREE' },
      })

      // Auto-approved - the Organiser doesn't need to review anything, so
      // the artist is the one who needs to know they're locked into the
      // lineup (mirrors the manual-decision push in applications/[id]).
      notifyAfterResponse(
        () =>
          sendPushToUser(user.id, {
            title: "You're in the lineup!",
            body: `Your application to "${event.title}" was auto-approved.`,
            url: `/dashboard/artist/events`,
          }),
        'application-auto-approve'
      )
    } else if (!isWaitlisted) {
      // Manual review needed - this is the Organiser's actual queue, not
      // just Admin's. Skip entirely on auto-approve or waitlist (above) -
      // nothing for the Organiser to act on in either case right now.
      notifyAfterResponse(
        () =>
          sendPushToUser(event.organiser.userId, {
            title: 'New application to review',
            body: `An artist applied to perform at "${event.title}".`,
            url: `/dashboard/organiser/events/${eventId}`,
          }),
        'new-application'
      )
    }

    return NextResponse.json(application, { status: 201 })
  } catch (err) {
    console.error('Error creating application:', err)
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
  }
}
