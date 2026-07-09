import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Read-only for now - there's no Admin UI to edit these yet (H4, not built).
// Falls back to sane defaults if the seeded row is ever missing, so callers
// never have to handle "no settings exist" as a special case.
export async function GET() {
  const settings = await prisma.platformSettings.findFirst()
  return NextResponse.json({
    flatVenueBookingFee: settings?.flatVenueBookingFee ?? 199,
    ticketCommissionRate: settings?.ticketCommissionRate ?? 0.08,
    performerSlotCommissionRate: settings?.performerSlotCommissionRate ?? 0.08,
  })
}
