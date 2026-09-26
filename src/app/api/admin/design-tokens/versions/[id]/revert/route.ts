import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { planRestore, radiusOrderErrors, restoreNote, type TokenType } from '@/lib/design-tokens'
import { revalidateDesignTokens } from '@/lib/design-tokens.server'

// POST /api/admin/design-tokens/versions/:id/revert — apply an older
// version's full snapshot back onto DesignToken, recorded as ANOTHER new
// version (so reverting is itself reversible, and version history never
// loses information by being overwritten in place).

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

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const version = await prisma.designTokenVersion.findUnique({ where: { id } })
  if (!version) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 })
  }

  // GEN-2609-108 / BUG-2609-061 - planRestore (shared with the confirm
  // dialog) decides what actually changes. Tokens added after this
  // version, snapshot keys that no longer exist, and snapshot values
  // today's rules reject are all left as they are.
  const snapshot = (version.snapshot ?? {}) as Record<string, unknown>
  const live = await prisma.designToken.findMany({ select: { key: true, value: true, type: true } })
  const plan = planRestore(snapshot, live.map((t) => ({ key: t.key, value: t.value, type: t.type as TokenType })))

  if (plan.changes.length === 0) {
    return NextResponse.json({ error: 'Nothing to restore: this version already matches the live values', skipped: plan.skipped }, { status: 400 })
  }

  const orderErrors = radiusOrderErrors(plan.after, plan.changes.map((c) => c.key))
  if (orderErrors.length > 0) {
    return NextResponse.json(
      { error: `Restoring this version would put the radius scale out of order: ${orderErrors.map((e) => `${e.key}: ${e.message}`).join(' ')}`, code: 'invalid', errors: orderErrors },
      { status: 400 },
    )
  }

  const now = new Date()
  await prisma.$transaction(
    [
      ...plan.changes.map((c) =>
        prisma.designToken.update({
          where: { key: c.key },
          data: { value: c.to, updatedBy: admin.id, updatedAt: now },
        }),
      ),
      prisma.designTokenVersion.create({
        data: {
          // The full live set after the restore, not the target's own
          // snapshot: the target may predate tokens that still exist.
          snapshot: plan.after,
          createdBy: admin.id,
          // Was "Reverted to version X (<target's note>)", which nested
          // on every restore-of-a-restore and reported the target's count.
          note: restoreNote(version.id, plan.changes.length),
        },
      }),
    ],
    // GEN-2609-076 - a revert can touch up to every token, same
    // round-trip-timeout risk and fix as reset/route.ts.
    { timeout: 20000, maxWait: 5000 },
  )

  revalidateDesignTokens()

  const tokens = await prisma.designToken.findMany({ orderBy: { key: 'asc' } })
  return NextResponse.json({ tokens, changed: plan.changes.length, skipped: plan.skipped })
}
