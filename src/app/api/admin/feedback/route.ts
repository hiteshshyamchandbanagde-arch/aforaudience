import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import type { FeedbackStatus, FeedbackSeverity } from '@prisma/client'

// GET  /api/admin/feedback — list submissions, newest first
// PATCH /api/admin/feedback — update a row's status and/or severity
//
// Admin-only, same requireAdmin() pattern as /api/admin/platform-settings
// and /api/admin/redeliver-ticket.
//
// GET takes one optional query param, `status`:
//   (absent)  → NEW + REVIEWED + TESTED. This is the Admin Dashboard's
//               default board/list query (design.md §9.1/§9.5) — RESOLVED
//               items are deliberately excluded unless asked for, per
//               Hitesh's settled call on a lazy "Show Resolved" toggle
//               rather than always loading them or a separate archive
//               page. TESTED added session 47 as a distinct pre-close
//               state (reviewed → built → tested on device → resolved).
//   RESOLVED  → resolved items only. Used by that toggle's lazy fetch.
//   ALL       → everything, no status filter. Used once by the trend
//               charts, which need the full picture (open + resolved)
//               regardless of what the board currently has loaded.
// Category/severity/page/keyword filtering stays client-side — the
// dataset is small at MVP volume, same reasoning as the original page.
//
// Still no pagination — add it once this list is actually long.

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

const VALID_STATUSES = ['NEW', 'REVIEWED', 'TESTED', 'RESOLVED']
const VALID_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export async function GET(req: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const statusParam = searchParams.get('status')

  let where: { status?: FeedbackStatus | { in: FeedbackStatus[] } } = {}
  if (statusParam === 'ALL') {
    where = {}
  } else if (statusParam === 'RESOLVED') {
    where = { status: 'RESOLVED' }
  } else if (statusParam && VALID_STATUSES.includes(statusParam)) {
    where = { status: statusParam as FeedbackStatus }
  } else {
    where = { status: { in: ['NEW', 'REVIEWED', 'TESTED'] } }
  }

  const items = await prisma.feedback.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 1000,
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
      changeLog: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          field: true,
          fromValue: true,
          toValue: true,
          createdAt: true,
          changedByUserId: true,
        },
      },
    },
  })

  return NextResponse.json({ items })
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { id?: string; status?: string; severity?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const hasStatus = body.status !== undefined
  const hasSeverity = body.severity !== undefined
  if (!hasStatus && !hasSeverity) {
    return NextResponse.json(
      { error: 'Provide at least one of status or severity' },
      { status: 400 }
    )
  }
  if (hasStatus && (!body.status || !VALID_STATUSES.includes(body.status))) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }
  // null is valid for severity - lets an admin clear a mistaken triage.
  if (hasSeverity && body.severity !== null && !VALID_SEVERITIES.includes(body.severity as string)) {
    return NextResponse.json(
      { error: `severity must be one of: ${VALID_SEVERITIES.join(', ')} or null` },
      { status: 400 }
    )
  }

  // Safe now: validated against VALID_STATUSES/VALID_SEVERITIES above,
  // which mirror the FeedbackStatus/FeedbackSeverity enums exactly.
  const newStatus = body.status as FeedbackStatus | undefined
  const newSeverity = body.severity as FeedbackSeverity | null | undefined

  try {
    const existing = await prisma.feedback.findUnique({
      where: { id: body.id },
      select: { status: true, severity: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Feedback item not found' }, { status: 404 })
    }

    const data: { status?: FeedbackStatus; resolvedAt?: Date | null; severity?: FeedbackSeverity | null } = {}
    const changeLogEntries: { field: string; fromValue: string | null; toValue: string }[] = []

    if (hasStatus && newStatus !== existing.status) {
      data.status = newStatus
      // resolvedAt tracks the most recent RESOLVED transition for
      // time-to-resolution metrics - clears if moved back off RESOLVED
      // (e.g. a mistaken close, reopened for more work) rather than
      // keeping a stale timestamp from a prior close.
      data.resolvedAt = newStatus === 'RESOLVED' ? new Date() : null
      changeLogEntries.push({ field: 'status', fromValue: existing.status, toValue: newStatus as string })
    }
    if (hasSeverity && newSeverity !== existing.severity) {
      data.severity = newSeverity ?? null
      changeLogEntries.push({
        field: 'severity',
        fromValue: existing.severity ?? null,
        toValue: newSeverity ?? 'null',
      })
    }

    if (Object.keys(data).length === 0) {
      // Nothing actually changed (e.g. re-selecting the same value) -
      // no-op, no changelog noise.
      const unchanged = await prisma.feedback.findUnique({
        where: { id: body.id },
        select: { id: true, status: true, severity: true, resolvedAt: true },
      })
      return NextResponse.json({ item: unchanged })
    }

    const [updated, ...createdChangeLogEntries] = await prisma.$transaction([
      prisma.feedback.update({
        where: { id: body.id },
        data,
        select: { id: true, status: true, severity: true, resolvedAt: true },
      }),
      ...changeLogEntries.map((entry) =>
        prisma.feedbackChangeLog.create({
          data: {
            feedbackId: body.id!,
            changedByUserId: admin.id,
            field: entry.field,
            fromValue: entry.fromValue,
            toValue: entry.toValue,
          },
        })
      ),
    ])
    return NextResponse.json({ item: updated, changeLog: createdChangeLogEntries })
  } catch {
    return NextResponse.json({ error: 'Feedback item not found' }, { status: 404 })
  }
}
