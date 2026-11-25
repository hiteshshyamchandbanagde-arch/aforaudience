import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * PATCH /api/admin/users/[id]/suspend
 * Body: { suspended: boolean, reason?: string }
 *
 * H3 — flag/suspend accounts (design.md §9.3). Admin-only.
 *
 * Suspending: blocks login immediately (auth.ts) and invalidates any
 * live session on its next check (session callback in auth.ts) rather
 * than waiting out the JWT's 7-day life. Hides the user's future
 * events/venues from public listings (GET /api/events, /api/venues -
 * enforced via the isSuspended flag on the relation, not by touching
 * Event/Venue rows). Deliberately does NOT cancel existing confirmed
 * bookings, existing published events, or existing published venues -
 * an audience member who already has a ticket isn't part of the reason
 * for the suspension.
 *
 * Unsuspending: fully reversible, clears all four fields. No separate
 * "banned" state - this is the only moderation lever for now.
 *
 * Can't suspend: yourself, or another ADMIN (avoids a moderation
 * feature turning into a way to lock out a fellow admin).
 */
async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  return user?.role === 'ADMIN' ? user : null
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { suspended, reason } = body

    if (typeof suspended !== 'boolean') {
      return NextResponse.json({ error: 'suspended (boolean) is required' }, { status: 400 })
    }
    if (suspended && (!reason || typeof reason !== 'string' || !reason.trim())) {
      return NextResponse.json({ error: 'reason is required to suspend an account' }, { status: 400 })
    }

    if (id === admin.id) {
      return NextResponse.json({ error: 'You cannot suspend your own account' }, { status: 400 })
    }

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if (target.role === 'ADMIN') {
      return NextResponse.json({ error: 'Cannot suspend another Admin account' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id },
      data: suspended
        ? {
            isSuspended: true,
            suspendedAt: new Date(),
            suspendReason: reason.trim(),
            suspendedByUserId: admin.id,
          }
        : {
            isSuspended: false,
            suspendedAt: null,
            suspendReason: null,
            suspendedByUserId: null,
          },
      select: { id: true, name: true, isSuspended: true, suspendedAt: true, suspendReason: true },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Error updating suspension status:', err)
    return NextResponse.json({ error: 'Failed to update suspension status' }, { status: 500 })
  }
}
