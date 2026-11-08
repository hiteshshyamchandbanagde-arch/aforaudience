import { NextResponse } from 'next/server'
import { getPaidBookingsEnabled } from '@/lib/platform-settings'

// D1b (8 Nov) - read-only UX hint for the organiser event form's payment
// mode picker (Online payment is disabled with "Coming soon" while the
// S1a switch is off). Not the enforcement: POST /api/events and
// PATCH /api/events/[id] still resolve the mode server-side via
// resolveEventPaymentMode and refuse ONLINE while the switch is off.
export async function GET() {
  const paidBookingsEnabled = await getPaidBookingsEnabled()
  return NextResponse.json({ paidBookingsEnabled })
}
