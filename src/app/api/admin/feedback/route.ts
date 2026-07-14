import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

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

  try {
    const updated = await prisma.feedback.update({
      where: { id: body.id },
      data: { status: body.status },
      select: { id: true, status: true },
    })
    return NextResponse.json({ item: updated })
  } catch {
    return NextResponse.json({ error: 'Feedback item not found' }, { status: 404 })
  }
}
