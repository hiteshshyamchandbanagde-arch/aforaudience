import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { snapshotNote, SNAPSHOT_REASON_MAX } from '@/lib/design-tokens'
import { listDesignTokenVersions } from '@/lib/design-tokens.server'

// POST /api/admin/design-tokens/snapshot — GEN-2609-115
//
// Body: { reason: string }. Writes one version row holding the full live
// token set, note `Snapshot: <reason>`, and changes no tokens. For
// recording a restore point after the DB was changed outside the editor
// (SQL applied after a merge), so History has a current row to restore.
// The SQL equivalent is in docs/afa-design-tokens-reference.md.

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const user = await prisma.user.findUnique({
    where: { id: (session.user as { id?: string }).id },
    select: { id: true, role: true },
  })
  if (!user || user.role !== 'ADMIN') return null
  return user
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { reason?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const note = snapshotNote(body?.reason)
  if (!note) {
    return NextResponse.json({ error: `reason must be a non-empty string of at most ${SNAPSHOT_REASON_MAX} characters` }, { status: 400 })
  }

  const rows = await prisma.designToken.findMany({ select: { key: true, value: true } })
  const snapshot: Record<string, string> = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const version = await prisma.designTokenVersion.create({
    data: { snapshot, createdBy: admin.id, note },
  })

  const versions = await listDesignTokenVersions()
  return NextResponse.json({ version: { id: version.id, note, keys: rows.length }, versions })
}
