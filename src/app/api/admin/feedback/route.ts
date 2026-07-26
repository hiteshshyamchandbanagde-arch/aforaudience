import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import type { FeedbackStatus } from '@prisma/client'

// GET  /api/admin/feedback — list submissions, newest first
// PATCH /api/admin/feedback — update a row's status (NEW/REVIEWED/RESOLVED)
//
// Admin-only, same requireAdmin() pattern as /api/admin/platform-settings
// and /api/admin/redeliver-ticket. Deliberately simple: no filtering,
// sorting, or pagination params yet — at real-world MVP volume (a
// handful of submissions a day) a flat newest-first list is enough.
// Add pagination when this actually becomes a long list.

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: { id: true, role: true },
  })
  if (!user || user.role !== 'ADMIN') return null
  return user
}

const VALID_STATUSES = ['NEW', 'REVIEWED', 'RESOLVED']

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const items = await prisma.feedback.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      category: true,
      message: true,
      pageUrl: true,
      fromChatbot: true,
      status: true,
      severity: true,
      title: true,
      resolvedAt: true,
      createdAt: true,
      attachmentData: true,
      user: { select: { name: true, email: true, displayName: true } },
    },
  })

  return NextResponse.json({ items })
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { id?: string; status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }
  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }
  // Safe now: validated against VALID_STATUSES above, which mirrors the
  // FeedbackStatus enum exactly (locked down this session - only these
  // 3 values have ever existed in this table).
  const newStatus = body.status as FeedbackStatus

  try {
    const existing = await prisma.feedback.findUnique({
      where: { id: body.id },
      select: { status: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Feedback item not found' }, { status: 404 })
    }

    const [updated] = await prisma.$transaction([
      prisma.feedback.update({
        where: { id: body.id },
        data: {
          status: newStatus,
          // resolvedAt tracks the most recent RESOLVED transition for
          // time-to-resolution metrics - clears if moved back off
          // RESOLVED (e.g. a mistaken close, reopened for more work)
          // rather than keeping a stale timestamp from a prior close.
          resolvedAt: newStatus === 'RESOLVED' ? new Date() : null,
        },
        select: { id: true, status: true, resolvedAt: true },
      }),
      prisma.feedbackChangeLog.create({
        data: {
          feedbackId: body.id,
          changedByUserId: admin.id,
          field: 'status',
          fromValue: existing.status,
          toValue: newStatus,
        },
      }),
    ])
    return NextResponse.json({ item: updated })
  } catch {
    return NextResponse.json({ error: 'Feedback item not found' }, { status: 404 })
  }
}
