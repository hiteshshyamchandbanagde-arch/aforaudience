import webpush from "web-push"
import prisma from "@/lib/prisma"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:info@aforaudience.com"

const configured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)

if (configured) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!)
}

export interface PushPayload {
  title: string
  body: string
  url?: string // where notificationclick should focus/open
}

/**
 * Sends a push notification to every subscription a user has (they may
 * have multiple - phone + laptop, or a re-install that didn't clean up the
 * old endpoint). Silently no-ops if VAPID isn't configured (e.g. local dev)
 * - same "don't fail the request over it" pattern as email.ts.
 *
 * A dead/expired subscription returns 404 or 410 from the push service.
 * We clean those up as we find them rather than leaving stale rows that
 * would just fail again next time.
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!configured) {
    console.warn("[push] VAPID keys not set, skipping send:", payload.title)
    return
  }

  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) return

  const body = JSON.stringify(payload)

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        )
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        } else {
          console.error("[push] send failed for", sub.id, err?.statusCode, err?.message)
        }
      }
    })
  )
}

/** Same as sendPushToUser, but fans out to every user of a given role. */
export async function sendPushToRole(role: "ADMIN" | "ORGANISER" | "VENUE_OWNER" | "ARTIST" | "AUDIENCE", payload: PushPayload) {
  if (!configured) {
    console.warn("[push] VAPID keys not set, skipping role send:", payload.title)
    return
  }
  const users = await prisma.user.findMany({ where: { role }, select: { id: true } })
  await Promise.all(users.map((u) => sendPushToUser(u.id, payload)))
}
