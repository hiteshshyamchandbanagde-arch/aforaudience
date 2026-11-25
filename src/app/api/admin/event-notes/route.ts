import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  return user?.role === 'ADMIN' ? user : null
}

// FEAT-2608-045 (11 Aug) - organiser-authored event "special notes"
// awaiting review before they're shown publicly. Same collapsible-section
// + approve/reject pattern as /api/admin/genre-requests, except reject
// here requires a reason (Hitesh: "reject with reason make sense") since
// an organiser needs to know what to fix, unlike a genre tag that's just
// silently not added to the shared filter list.
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const pending = await prisma.event.findMany({
    where: { specialNotesStatus: 'PENDING' },
    select: {
      id: true,
      title: true,
      specialNotes: true,
      date: true,
      organiser: { select: { orgName: true } },
    },
    orderBy: { updatedAt: 'asc' },
  })
  return NextResponse.json({ pending })
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, action, reason } = await req.json().catch(() => ({}))
  if (typeof id !== 'string' || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (action === 'reject' && (typeof reason !== 'string' || !reason.trim())) {
    return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 })
  }

  const event = await prisma.event.findUnique({ where: { id }, select: { specialNotesStatus: true } })
  if (!event || event.specialNotesStatus !== 'PENDING') {
    return NextResponse.json({ error: 'Nothing pending for this event' }, { status: 404 })
  }

  const updated = await prisma.event.update({
    where: { id },
    data: {
      specialNotesStatus: action === 'approve' ? 'APPROVED' : 'REJECTED',
      specialNotesRejectionReason: action === 'reject' ? reason.trim().slice(0, 300) : null,
      specialNotesReviewedAt: new Date(),
    },
  })

  return NextResponse.json(updated)
}
