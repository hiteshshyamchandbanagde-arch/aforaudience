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

// Session 39, PR #224 - pending "Other" genre submissions. Approving one
// makes it a public filter-chip option on /artists (see GET
// /api/genres/approved); rejecting one keeps it out of that shared list
// forever (the submitting artist's own profile is never touched either
// way - this only gates the GLOBAL surface, not their own page).
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const pending = await prisma.genreRequest.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ pending })
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, action } = await req.json().catch(() => ({}))
  if (typeof id !== 'string' || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const updated = await prisma.genreRequest.update({
    where: { id },
    data: { status: action === 'approve' ? 'APPROVED' : 'REJECTED', reviewedAt: new Date() },
  })

  return NextResponse.json(updated)
}
