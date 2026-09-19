import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isValidTokenValue, type TokenType } from '@/lib/design-tokens'
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

  const snapshot = version.snapshot as Record<string, string>
  const currentTokens = await prisma.designToken.findMany({ select: { key: true, type: true } })
  const typeByKey = new Map(currentTokens.map((t) => [t.key, t.type as TokenType]))

  // The snapshot can only contain keys that were real tokens at save
  // time — but a key could since have been removed from the live table
  // (schema evolved) or, defense in depth, the stored value could no
  // longer pass validation (type definitions changed). Either way,
  // silently skip rather than fail the whole revert over one stale key.
  const applicable = Object.entries(snapshot).filter(([key, value]) => {
    const type = typeByKey.get(key)
    return type !== undefined && isValidTokenValue(type, value)
  })

  if (applicable.length === 0) {
    return NextResponse.json({ error: 'Nothing in this version applies to the current token set' }, { status: 400 })
  }

  const now = new Date()
  await prisma.$transaction(
    [
      ...applicable.map(([key, value]) =>
        prisma.designToken.update({
          where: { key },
          data: { value, updatedBy: admin.id, updatedAt: now },
        }),
      ),
      prisma.designTokenVersion.create({
        data: {
          snapshot,
          createdBy: admin.id,
          note: `Reverted to version ${version.id} (${version.note ?? 'no note'})`,
        },
      }),
    ],
    // GEN-2609-076 - a revert can touch up to all 93 tokens too (a
    // snapshot can be a full set), same round-trip-timeout risk and
    // fix as reset/route.ts.
    { timeout: 20000, maxWait: 5000 },
  )

  revalidateDesignTokens()

  const tokens = await prisma.designToken.findMany({ orderBy: { key: 'asc' } })
  return NextResponse.json({ tokens })
}
