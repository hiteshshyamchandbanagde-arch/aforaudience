import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  getPlatformSettings,
  setAudienceBookingFee,
  MAX_BOOKING_FEE_PAISE,
} from '@/lib/platform-settings'

// GET /api/admin/platform-settings
// PATCH /api/admin/platform-settings
//
// Admin-only. Reads and writes the singleton PlatformSettings row.
//
// Deliberately narrow projection — this endpoint is UI-facing, not a
// generic config export. If we add more admin-editable fields later,
// they get plumbed through here explicitly, not passed via generic
// key/value objects.

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
  const settings = await getPlatformSettings()
  return NextResponse.json({
    settings,
    limits: {
      maxBookingFeePaise: MAX_BOOKING_FEE_PAISE,
    },
  })
}

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

  // audienceBookingFee accepted as PAISE (integer). The UI converts
  // from rupees on submit so the wire format stays consistent with
  // Payment.amount and the rest of the money-handling code.
  if (!Object.prototype.hasOwnProperty.call(body, 'audienceBookingFee')) {
    return NextResponse.json(
      { error: 'audienceBookingFee is required' },
      { status: 400 }
    )
  }
  const paise = body.audienceBookingFee
  if (typeof paise !== 'number' || !Number.isFinite(paise)) {
    return NextResponse.json(
      { error: 'audienceBookingFee must be a number (paise)' },
      { status: 400 }
    )
  }

  try {
    const updated = await setAudienceBookingFee(Math.round(paise))
    return NextResponse.json({ settings: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
