import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidateDesignTokens } from '@/lib/design-tokens.server'

// POST /api/admin/design-tokens/revalidate — GEN-2609-108
//
// Drops the cached token set so the next page load re-reads the DB. For
// changes made outside the editor (SQL applied after a merge), which
// otherwise wait for the cache's 5-minute expiry. Writes nothing: no
// token rows, no version row.

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

export async function POST() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  revalidateDesignTokens()
  return NextResponse.json({ ok: true })
}
