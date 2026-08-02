import { NextResponse } from 'next/server'
import { getPlatformSettings } from '@/lib/platform-settings'

// Feedback cms9ynuxi (2 Aug) - separate tiny endpoint rather than
// extending the existing /api/platform-settings route, since that one
// only serves the deprecated commission-rate fields (see its own
// comment) and isn't the right place to add a live setting. Public/
// read-only - this is a UX hint for the date picker's `max`, not the
// real enforcement (that's server-side in events/route.ts and
// events/[id]/route.ts, which can't be bypassed by skipping this call).
export async function GET() {
  const { eventCreationWindowMonths } = await getPlatformSettings()
  return NextResponse.json({ eventCreationWindowMonths })
}
