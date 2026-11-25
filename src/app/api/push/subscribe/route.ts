import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Any logged-in user, any role - notifications aren't admin-only.
async function requireUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return session.user as any
}

export async function POST(req: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { subscription } = await req.json()
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 })
  }

  // Upsert on endpoint (unique) - the same browser re-subscribing (e.g.
  // after clearing storage) should update the row, not fail on the
  // unique constraint or create a duplicate.
  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: req.headers.get("user-agent") || undefined,
    },
    // Re-subscribing can also mean a different logged-in user on a shared
    // device - re-point the row to whoever is asking now.
    update: {
      userId: user.id,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: req.headers.get("user-agent") || undefined,
    },
  })

  return NextResponse.json({ message: "Subscribed" })
}

export async function DELETE(req: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { endpoint } = await req.json()
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 })

  // Only delete if it belongs to the requesting user - don't let one
  // user's unsubscribe call remove someone else's row by guessing an
  // endpoint string.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } })

  return NextResponse.json({ message: "Unsubscribed" })
}
