import { NextResponse } from 'next/server';
import { getPlatformSettings } from '@/lib/platform-settings';
import { anthropicCredentialsPresent } from '@/lib/anthropic';

// ---------------------------------------------------------------------------
// GET /api/chat/config
//
// Public (no auth) — the support widget calls this on mount to learn the
// current per-session message cap before rendering the chat tab. Not
// sensitive: it's a single integer, not a secret. Kept as its own tiny
// endpoint rather than piggybacking on /api/admin/platform-settings so
// the widget never needs to hit an admin-gated route.
//
// Also reports whether the chatbot is configured at all (ANTHROPIC_API_KEY
// present) so the widget can show "temporarily unavailable" instead of a
// confusing failed request on environments where the key isn't set yet.
// ---------------------------------------------------------------------------

export async function GET() {
  const settings = await getPlatformSettings();
  return NextResponse.json({
    maxMessagesPerSession: settings.chatMaxMessagesPerSession,
    chatEnabled: anthropicCredentialsPresent() && settings.chatMaxMessagesPerSession > 0,
  });
}
