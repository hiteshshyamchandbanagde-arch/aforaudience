import webpush from "web-push"
import { after } from "next/server"
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

  const pushOptions: webpush.RequestOptions & { urgency?: "very-low" | "low" | "normal" | "high" } = {
    // Default urgency is 'normal', which Android's Doze/battery
    // optimization is allowed to defer for minutes at a time on an idle
    // device - confirmed happening live (a sales-milestone push arrived
    // several minutes late). 'high' tells the push service (FCM under
    // the hood for Chrome/Android) this should wake the device promptly.
    //
    // web-push's own runtime (web-push-lib.js) reads options.urgency
    // directly and sets the Urgency header itself, unconditionally
    // overwriting anything passed via options.headers.Urgency - so this
    // has to go through options.urgency, not headers. @types/web-push's
    // RequestOptions doesn't declare this field even though the JS
    // implementation supports it (checked node_modules/web-push/src
    // directly), hence the local type augmentation above.
    urgency: "high",
    // Don't let an old notification surface hours later if the device
    // was offline - 1 hour covers "was in a dead zone", not "was off
    // for a week".
    TTL: 60 * 60,
  }

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          pushOptions
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

/**
 * Fire a push send without blocking the response, but WITHOUT the risk
 * of a bare un-awaited call: Vercel serverless functions can freeze the
 * runtime as soon as the response is sent, silently killing any in-flight
 * work that wasn't explicitly kept alive - no error, no log, it just
 * never finishes. `after()` (Next.js 15.1+) is exactly the guarantee
 * needed here: run this after the response is sent, but don't let the
 * function terminate until it's done. Discovered this the hard way - a
 * bare `sendPushToUser(...).catch(...)` worked twice, then silently
 * dropped a third time with zero trace anywhere.
 */
export function notifyAfterResponse(fn: () => Promise<void>, label: string) {
  after(() => fn().catch((err) => console.error(`[push] ${label} notify failed`, err)))
}
