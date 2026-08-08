import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import type { DiaryStatus } from '@prisma/client'

// GET    /api/admin/diary  — list entries, newest first
// POST   /api/admin/diary  — create an entry (title required, status defaults PENDING)
// PATCH  /api/admin/diary  — update an entry's status and/or notes/title (id required)
//
// Admin-only, same requireAdmin() pattern as /api/admin/feedback and
// /api/admin/platform-settings. Free-form company/legal/admin log —
// separate from Feedback (product bugs/ideas) and docs/admin-diary.md
// (the original markdown log this table supersedes for anything
// requiring status tracking; the markdown file is left in place as a
// dated narrative record, this table is the structured/actionable view).

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: { id: true, role: true, name: true, email: true },
  })
  if (!user || user.role !== 'ADMIN') return null
  return user
}

const VALID_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED']

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const entries = await prisma.adminDiaryEntry.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ entries })
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : null
  const status = VALID_STATUSES.includes(body?.status) ? (body.status as DiaryStatus) : 'PENDING'

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const entry = await prisma.adminDiaryEntry.create({
    data: {
      title,
      notes: notes || null,
      status,
      createdBy: admin.name || admin.email || admin.id,
    },
  })
  return NextResponse.json({ entry }, { status: 201 })
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : null
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const data: { status?: DiaryStatus; title?: string; notes?: string | null } = {}
  if (VALID_STATUSES.includes(body?.status)) data.status = body.status as DiaryStatus
  if (typeof body?.title === 'string' && body.title.trim()) data.title = body.title.trim()
  if (typeof body?.notes === 'string') data.notes = body.notes.trim() || null

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const entry = await prisma.adminDiaryEntry.update({ where: { id }, data })
  return NextResponse.json({ entry })
}
