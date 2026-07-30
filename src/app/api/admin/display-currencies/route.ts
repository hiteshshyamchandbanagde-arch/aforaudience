import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/admin/display-currencies
// PATCH /api/admin/display-currencies
//
// Admin-only. Views/edits DisplayCurrencyRate rows - the admin-set,
// manually-updated rates behind the display-only currency preference
// (Option A, session 47). Same requireAdmin shape as
// /api/admin/platform-settings. INR itself is not editable here - its
// rate is always exactly 1 by definition, changing it would silently
// break every other currency's conversion math.

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
  const currencies = await prisma.displayCurrencyRate.findMany({
    orderBy: { code: 'asc' },
  })
  return NextResponse.json({ currencies })
}

// PATCH body: { code: string, rateFromINR: number }
// Updates one currency's rate at a time - matches the per-row Save
// button in the admin UI, rather than a bulk-array shape that risks a
// partial-failure-halfway-through-save problem.
export async function PATCH(req: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  if (!code) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 })
  }
  if (code === 'INR') {
    return NextResponse.json({ error: 'INR rate is fixed at 1 and cannot be edited' }, { status: 400 })
  }

  const rate = Number(body.rateFromINR)
  if (!Number.isFinite(rate) || rate <= 0) {
    return NextResponse.json({ error: 'rateFromINR must be a positive number' }, { status: 400 })
  }

  const existing = await prisma.displayCurrencyRate.findUnique({ where: { code } })
  if (!existing) {
    return NextResponse.json({ error: `Unknown currency code: ${code}` }, { status: 404 })
  }

  const updated = await prisma.displayCurrencyRate.update({
    where: { code },
    data: { rateFromINR: rate },
  })

  return NextResponse.json({ currency: updated })
}
