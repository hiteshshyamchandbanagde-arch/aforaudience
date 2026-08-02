import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import type { FeedbackStatus, FeedbackSeverity, FeedbackDeployStage } from '@prisma/client'

// GET  /api/admin/feedback — list submissions, newest first
// PATCH /api/admin/feedback — update a row's status, deployStage, and/or severity
//
// Admin-only, same requireAdmin() pattern as /api/admin/platform-settings
// and /api/admin/redeliver-ticket.
//
// Workflow overhaul (session 63, Hitesh's design) - two-field split:
//   status:      NEW -> UNDER_REVIEW -> BUILD_QUEUE -> IN_BUILD ->
//                BUILD_COMPLETE -> IN_TEST -> RESOLVED
//                branches: UNDER_REVIEW -> REJECTED (note required)
//                          RESOLVED -> REOPENED (note required)
//   deployStage: only meaningful once status = RESOLVED. DEPLOYED_QA ->
//                IN_PRODUCT -> NOTIFIED_USER -> CLOSED. Separate field on
//                purpose - "is it fixed" and "is it deployed" move
//                independently, especially under the current prod
//                freeze where everything caps at DEPLOYED_QA regardless
//                of status.
//
// GET takes one optional query param, `status`:
//   (absent)  → everything except RESOLVED and REJECTED. This is the
//               Admin Dashboard's default board/list query (design.md
//               §9.1/§9.5) — closed-out items are deliberately excluded
//               unless asked for, per Hitesh's settled call on a lazy
//               "Show Resolved" toggle rather than always loading them.
//   RESOLVED  → resolved items only. Used by that toggle's lazy fetch.
//   ALL       → everything, no status filter. Used once by the trend
//               charts, which need the full picture regardless of what
//               the board currently has loaded.
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

const VALID_STATUSES = [
  'NEW', 'UNDER_REVIEW', 'BUILD_QUEUE', 'IN_BUILD', 'BUILD_COMPLETE',
  'IN_TEST', 'RESOLVED', 'REJECTED', 'REOPENED',
]
const OPEN_STATUSES = [
  'NEW', 'UNDER_REVIEW', 'BUILD_QUEUE', 'IN_BUILD', 'BUILD_COMPLETE',
  'IN_TEST', 'REOPENED',
]
const VALID_DEPLOY_STAGES = ['DEPLOYED_QA', 'IN_PRODUCT', 'NOTIFIED_USER', 'CLOSED']
const VALID_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
// Transitions that need admin justification, per Hitesh's design -
// rejecting needs a reason, reopening after the pipeline already called
// it done needs a comment on what's actually still wrong.
const NOTE_REQUIRED_STATUSES = ['REJECTED', 'REOPENED']

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
    where = { status: { in: OPEN_STATUSES as FeedbackStatus[] } }
  }

  const items = await prisma.feedback.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 1000,
    select: {
      id: true,
      displayId: true,
      category: true,
      message: true,
      pageUrl: true,
      fromChatbot: true,
      status: true,
      deployStage: true,
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
          note: true,
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

  let body: { id?: string; status?: string; deployStage?: string | null; note?: string; severity?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const hasStatus = body.status !== undefined
  const hasDeployStage = body.deployStage !== undefined
  const hasSeverity = body.severity !== undefined
  if (!hasStatus && !hasDeployStage && !hasSeverity) {
    return NextResponse.json(
      { error: 'Provide at least one of status, deployStage, or severity' },
      { status: 400 }
    )
  }
  if (hasStatus && (!body.status || !VALID_STATUSES.includes(body.status))) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }
  // null is valid for deployStage - lets an admin walk a mistaken
  // promotion back (e.g. accidentally marked NOTIFIED_USER).
  if (hasDeployStage && body.deployStage !== null && !VALID_DEPLOY_STAGES.includes(body.deployStage as string)) {
    return NextResponse.json(
      { error: `deployStage must be one of: ${VALID_DEPLOY_STAGES.join(', ')} or null` },
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
  // Rejecting or reopening without saying why just recreates the same
  // "why is this stuck" confusion the workflow overhaul was meant to
  // fix - Hitesh's explicit design ("Rejected (Reason provided by
  // admin)", "Reopen with comment").
  if (hasStatus && NOTE_REQUIRED_STATUSES.includes(body.status as string) && !body.note?.trim()) {
    return NextResponse.json(
      { error: `A note is required when setting status to ${body.status}` },
      { status: 400 }
    )
  }

  // Safe now: validated against VALID_STATUSES/VALID_DEPLOY_STAGES/
  // VALID_SEVERITIES above, which mirror the Prisma enums exactly.
  const newStatus = body.status as FeedbackStatus | undefined
  const newDeployStage = body.deployStage as FeedbackDeployStage | null | undefined
  const newSeverity = body.severity as FeedbackSeverity | null | undefined

  try {
    const existing = await prisma.feedback.findUnique({
      where: { id: body.id },
      select: { status: true, deployStage: true, severity: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Feedback item not found' }, { status: 404 })
    }

    const data: {
      status?: FeedbackStatus
      deployStage?: FeedbackDeployStage | null
      resolvedAt?: Date | null
      severity?: FeedbackSeverity | null
    } = {}
    const changeLogEntries: { field: string; fromValue: string | null; toValue: string; note?: string }[] = []

    if (hasStatus && newStatus !== existing.status) {
      data.status = newStatus
      // resolvedAt tracks the most recent RESOLVED transition for
      // time-to-resolution metrics - clears if moved back off RESOLVED
      // (e.g. REOPENED) rather than keeping a stale timestamp from a
      // prior close.
      data.resolvedAt = newStatus === 'RESOLVED' ? new Date() : null
      // deployStage only means anything while status = RESOLVED - if
      // this transition leaves RESOLVED (e.g. REOPENED for more work),
      // whatever promotion progress was recorded no longer applies and
      // would be misleading left in place.
      if (newStatus !== 'RESOLVED' && existing.deployStage !== null) {
        data.deployStage = null
      }
      changeLogEntries.push({
        field: 'status',
        fromValue: existing.status,
        toValue: newStatus as string,
        note: NOTE_REQUIRED_STATUSES.includes(newStatus as string) ? body.note?.trim() : undefined,
      })
    }
    if (hasDeployStage && newDeployStage !== existing.deployStage) {
      data.deployStage = newDeployStage ?? null
      changeLogEntries.push({
        field: 'deployStage',
        fromValue: existing.deployStage ?? null,
        toValue: newDeployStage ?? 'null',
      })
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
        select: { id: true, status: true, deployStage: true, severity: true, resolvedAt: true },
      })
      return NextResponse.json({ item: unchanged })
    }

    const [updated, ...createdChangeLogEntries] = await prisma.$transaction([
      prisma.feedback.update({
        where: { id: body.id },
        data,
        select: { id: true, status: true, deployStage: true, severity: true, resolvedAt: true },
      }),
      ...changeLogEntries.map((entry) =>
        prisma.feedbackChangeLog.create({
          data: {
            feedbackId: body.id!,
            changedByUserId: admin.id,
            field: entry.field,
            fromValue: entry.fromValue,
            toValue: entry.toValue,
            note: entry.note ?? null,
          },
        })
      ),
    ])
    return NextResponse.json({ item: updated, changeLog: createdChangeLogEntries })
  } catch {
    return NextResponse.json({ error: 'Feedback item not found' }, { status: 404 })
  }
}
