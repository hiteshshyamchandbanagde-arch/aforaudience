import prisma from '@/lib/prisma'
import { sendPushToUser, notifyAfterResponse } from '@/lib/push'

export type FollowTargetType = 'ARTIST' | 'VENUE' | 'ORGANISER'

// Resolves the target's underlying User id (for the "new follower" push)
// given the target's own id (not the User id). Artist/Organiser have a
// direct userId; Venue routes through its VenueOwner.
async function resolveTargetOwner(targetType: FollowTargetType, targetId: string) {
  if (targetType === 'ARTIST') {
    const artist = await prisma.artist.findUnique({ where: { id: targetId }, select: { userId: true } })
    return artist ? { userId: artist.userId, dashboardUrl: '/dashboard/artist' } : null
  }
  if (targetType === 'ORGANISER') {
    const organiser = await prisma.organiser.findUnique({ where: { id: targetId }, select: { userId: true } })
    return organiser ? { userId: organiser.userId, dashboardUrl: '/dashboard/organiser' } : null
  }
  const venue = await prisma.venue.findUnique({
    where: { id: targetId },
    select: { owner: { select: { userId: true } } },
  })
  return venue ? { userId: venue.owner.userId, dashboardUrl: '/dashboard/venue' } : null
}

export async function getFollowStatus(userId: string | null, targetType: FollowTargetType, targetId: string) {
  if (!userId) return { following: false, notifyEnabled: false }
  const existing = await prisma.follow.findUnique({
    where: { userId_targetType_targetId: { userId, targetType, targetId } },
  })
  return { following: !!existing, notifyEnabled: existing?.notifyEnabled ?? true }
}

// Toggle - follows if not already following, unfollows if already following.
// Returns null if the target itself doesn't exist.
export async function toggleFollow(userId: string, targetType: FollowTargetType, targetId: string) {
  const owner = await resolveTargetOwner(targetType, targetId)
  if (!owner) return null

  const existing = await prisma.follow.findUnique({
    where: { userId_targetType_targetId: { userId, targetType, targetId } },
  })

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } })
    return { following: false, notifyEnabled: false }
  }

  await prisma.follow.create({ data: { userId, targetType, targetId } })

  // Only on a new follow, not unfollow - nobody needs a push for someone
  // quietly un-following them.
  const follower = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, displayName: true } })
  notifyAfterResponse(
    () =>
      sendPushToUser(owner.userId, {
        title: 'New follower',
        body: `${follower?.displayName || follower?.name || 'Someone'} started following you.`,
        url: owner.dashboardUrl,
      }),
    'new-follower'
  )

  return { following: true, notifyEnabled: true }
}

// Bell toggle - mutes/unmutes new-activity push for an existing follow.
// Returns null if not currently following (nothing to mute).
export async function setNotifyEnabled(
  userId: string,
  targetType: FollowTargetType,
  targetId: string,
  notifyEnabled: boolean
) {
  const existing = await prisma.follow.findUnique({
    where: { userId_targetType_targetId: { userId, targetType, targetId } },
  })
  if (!existing) return null
  await prisma.follow.update({ where: { id: existing.id }, data: { notifyEnabled } })
  return { following: true, notifyEnabled }
}

// Notifies every follower with notifyEnabled=true that a target has a new
// published event. Fire-and-forget per follower via the existing
// sendPushToUser/notifyAfterResponse plumbing - callers should invoke this
// only on a genuine DRAFT/PENDING_APPROVAL -> APPROVED transition, not on
// every save of an already-live event.
export async function notifyFollowersOfNewEvent(
  targetType: FollowTargetType,
  targetId: string,
  event: { id: string; title: string }
) {
  const followers = await prisma.follow.findMany({
    where: { targetType, targetId, notifyEnabled: true },
    select: { userId: true },
  })
  if (followers.length === 0) return

  notifyAfterResponse(async () => {
    await Promise.all(
      followers.map((f) =>
        sendPushToUser(f.userId, {
          title: 'New event',
          body: `${event.title} was just announced.`,
          url: `/events/${event.id}`,
        })
      )
    )
  }, 'new-event-followers')
}
