import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/admin/users?search=&role=
 *
 * H3 — powers /dashboard/admin/users. Search by name/displayName/email
 * (case-insensitive substring), optionally filtered by role. Admin-only.
 * No pagination beyond a hard limit - at current QA volume (a few dozen
 * users) a single page is fine; revisit if that changes.
 */
async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  return user?.role === 'ADMIN' ? user : null
}

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim()
    const role = searchParams.get('role')

    const users = await prisma.user.findMany({
      where: {
        ...(role ? { role: role as any } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { displayName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        email: true,
        role: true,
        isSuspended: true,
        suspendedAt: true,
        suspendReason: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ users })
  } catch (err) {
    console.error('Error fetching admin user list:', err)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
