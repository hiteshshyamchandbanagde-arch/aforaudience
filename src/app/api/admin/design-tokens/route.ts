import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isValidTokenValue, LOCKED_TOKEN_KEYS, type TokenType } from '@/lib/design-tokens'
import { revalidateDesignTokens } from '@/lib/design-tokens.server'

// GET /api/admin/design-tokens — every token row + recent version history
// PATCH /api/admin/design-tokens — bulk update (one save = one version)
//
// Admin-only. See src/lib/design-tokens.ts's header for why token values
// are validated this strictly server-side (they land unescaped in a
// <style> tag served to every visitor, not just admin-facing UI).

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

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [tokens, versions] = await Promise.all([
    prisma.designToken.findMany({ orderBy: { key: 'asc' } }),
    prisma.designTokenVersion.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
  ])

  return NextResponse.json({ tokens, versions })
}

type PatchBody = {
  changes: { key: string; value: string }[]
  note?: string
  confirmLocked?: boolean
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: PatchBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!Array.isArray(body.changes) || body.changes.length === 0) {
    return NextResponse.json({ error: 'changes must be a non-empty array' }, { status: 400 })
  }
  if (body.changes.length > 100) {
    return NextResponse.json({ error: 'Too many changes in one save' }, { status: 400 })
  }

  const keys = body.changes.map((c) => c.key)
  const existing = await prisma.designToken.findMany({ where: { key: { in: keys } } })
  const existingByKey = new Map(existing.map((t) => [t.key, t]))

  // Every key must be a real, known token — this is an update surface,
  // not a generic key/value store an admin (or a bug) could use to add
  // arbitrary new custom properties to every page.
  const unknown = keys.filter((k) => !existingByKey.has(k))
  if (unknown.length > 0) {
    return NextResponse.json({ error: `Unknown token key(s): ${unknown.join(', ')}` }, { status: 400 })
  }

  const touchesLocked = body.changes.some((c) => LOCKED_TOKEN_KEYS.has(c.key))
  if (touchesLocked && !body.confirmLocked) {
    return NextResponse.json(
      { error: 'One or more changed tokens are locked — resubmit with confirmLocked: true after showing the confirm dialog', lockedKeys: body.changes.filter((c) => LOCKED_TOKEN_KEYS.has(c.key)).map((c) => c.key) },
      { status: 409 },
    )
  }

  for (const change of body.changes) {
    const token = existingByKey.get(change.key)!
    if (!isValidTokenValue(token.type as TokenType, change.value)) {
      return NextResponse.json({ error: `Invalid value for ${change.key}: ${change.value}` }, { status: 400 })
    }
  }

  const now = new Date()
  await prisma.$transaction([
    ...body.changes.map((c) =>
      prisma.designToken.update({
        where: { key: c.key },
        data: { value: c.value, updatedBy: admin.id, updatedAt: now },
      }),
    ),
    prisma.designTokenVersion.create({
      data: {
        snapshot: await snapshotAfter(body.changes),
        createdBy: admin.id,
        note: body.note ?? `Updated ${body.changes.length} token(s)`,
      },
    }),
  ])

  revalidateDesignTokens()

  const tokens = await prisma.designToken.findMany({ orderBy: { key: 'asc' } })
  return NextResponse.json({ tokens })
}

// The version snapshot records the FULL token set as it will be right
// after this save (not just the diff) — reverting to any version later
// is then just "apply this snapshot," no diffing/merging logic needed.
async function snapshotAfter(changes: { key: string; value: string }[]): Promise<Record<string, string>> {
  const allRows = await prisma.designToken.findMany({ select: { key: true, value: true } })
  const map = new Map(allRows.map((r) => [r.key, r.value]))
  for (const c of changes) map.set(c.key, c.value)
  return Object.fromEntries(map)
}
