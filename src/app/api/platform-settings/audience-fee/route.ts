import { NextResponse } from 'next/server'
import { getPlatformSettings } from '@/lib/platform-settings'

// Read-only, public. Kept as its own tiny route rather than folding into
// the existing GET /api/platform-settings, which still returns three
// fields explicitly marked deprecated in the schema (flagged separately,
// 28 Jul - not fixed here to keep this change scoped to the
// adjustable-booking-fee feature). This route only ever reads the real,
// current audienceBookingFee value via the shared getPlatformSettings()
// helper, converted to rupees for direct use in the seat-picker UI.
export async function GET() {
  const settings = await getPlatformSettings()
  return NextResponse.json({
    audienceBookingFeeRupees: settings.audienceBookingFee / 100,
  })
}
