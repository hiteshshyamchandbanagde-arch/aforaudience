import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { DEFAULT_TOKEN_VALUES } from '@/lib/design-tokens'
import { revalidateDesignTokens } from '@/lib/design-tokens.server'

// POST /api/admin/design-tokens/reset — restore every token to its
// globals.css default (DEFAULT_TOKEN_VALUES), recorded as a new version
// so this is undoable via the normal revert flow, not a one-way door.

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

  const now = new Date()
  await prisma.$transaction(
    [
      ...Object.entries(DEFAULT_TOKEN_VALUES).map(([key, value]) =>
        prisma.designToken.update({
          where: { key },
          data: { value, updatedBy: admin.id, updatedAt: now },
        }),
      ),
      prisma.designTokenVersion.create({
        data: {
          snapshot: DEFAULT_TOKEN_VALUES,
          createdBy: admin.id,
          note: 'Reset to defaults',
        },
      }),
    ],
    // GEN-2609-076 - this always writes all 93 tokens + 1 version row
    // as 94 sequential round-trips over one connection (prisma.ts caps
    // the pool at max:1). Prisma's default $transaction timeout is
    // 5000ms - over real network latency to Supabase that's plausibly
    // not enough, and the failure mode is a silent, unexplained "Reset
    // failed" with no indication why. Not a hypothetical: found by
    // re-reading this route specifically because Reset was reported
    // broken. Generous headroom, not tuned to a measured number.
    { timeout: 20000, maxWait: 5000 },
  )

  revalidateDesignTokens()

  const tokens = await prisma.designToken.findMany({ orderBy: { key: 'asc' } })
  return NextResponse.json({ tokens })
}
