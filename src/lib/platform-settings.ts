import prisma from "@/lib/prisma"

// ---------------------------------------------------------------------------
// Platform settings — cached read, one row, keyed by the constant id
// "singleton". Every caller (checkout, booking creation, admin UI) goes
// through this helper so there's a single place to change behavior if
// we ever want to hot-reload settings or add per-tenant overrides.
//
// Deliberately simple: no in-process cache. Prisma queries against a
// single-row table are cheap enough not to bother. If we ever put this
// on a hot path we'll add a 30s TTL cache here; not needed today.
//
// Idempotent seed: if the singleton row is somehow missing (fresh env
// where migrations haven't been backfilled yet), upserts a zero-fee row
// so downstream callers can rely on the return being non-null.
// ---------------------------------------------------------------------------

export type PlatformSettings = {
  audienceBookingFee: number // paise
  chatMaxMessagesPerSession: number
}

const SINGLETON_ID = "singleton"

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const row = await prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID, audienceBookingFee: 0 },
    select: { audienceBookingFee: true, chatMaxMessagesPerSession: true },
  })
  return {
    audienceBookingFee: row.audienceBookingFee,
    chatMaxMessagesPerSession: row.chatMaxMessagesPerSession,
  }
}

/**
 * Admin-only setter. Validates the input as a non-negative integer
 * (paise) and caps at a sanity ceiling (₹500 = 50000 paise) so a
 * fat-fingered save doesn't silently start charging every audience
 * member ₹5000. The cap is soft — if we ever want to charge more,
 * we bump this constant and ship a new deploy on purpose.
 */
export const MAX_BOOKING_FEE_PAISE = 50000

export async function setAudienceBookingFee(paise: number): Promise<PlatformSettings> {
  if (!Number.isInteger(paise) || paise < 0) {
    throw new Error("audienceBookingFee must be a non-negative integer (paise)")
  }
  if (paise > MAX_BOOKING_FEE_PAISE) {
    throw new Error(
      `audienceBookingFee cannot exceed ${MAX_BOOKING_FEE_PAISE} paise (₹${MAX_BOOKING_FEE_PAISE / 100})`
    )
  }
  const row = await prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    update: { audienceBookingFee: paise },
    create: { id: SINGLETON_ID, audienceBookingFee: paise },
    select: { audienceBookingFee: true, chatMaxMessagesPerSession: true },
  })
  return {
    audienceBookingFee: row.audienceBookingFee,
    chatMaxMessagesPerSession: row.chatMaxMessagesPerSession,
  }
}

/**
 * Admin-only setter for the chatbot's per-session message cap. 0 (or
 * any non-positive value) is treated as an emergency killswitch —
 * disables the chat tab entirely (widget shows a "temporarily
 * unavailable, use feedback" message) without needing a deploy.
 * Ceiling of 200 is a sanity guard, not a real expectation of use —
 * if a legitimate case for more ever comes up, bump this constant
 * deliberately.
 */
export const MAX_CHAT_MESSAGES_CAP = 200

export async function setChatMaxMessagesPerSession(
  cap: number
): Promise<PlatformSettings> {
  if (!Number.isInteger(cap)) {
    throw new Error("chatMaxMessagesPerSession must be an integer")
  }
  if (cap > MAX_CHAT_MESSAGES_CAP) {
    throw new Error(`chatMaxMessagesPerSession cannot exceed ${MAX_CHAT_MESSAGES_CAP}`)
  }
  const row = await prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    update: { chatMaxMessagesPerSession: cap },
    create: { id: SINGLETON_ID, chatMaxMessagesPerSession: cap },
    select: { audienceBookingFee: true, chatMaxMessagesPerSession: true },
  })
  return {
    audienceBookingFee: row.audienceBookingFee,
    chatMaxMessagesPerSession: row.chatMaxMessagesPerSession,
  }
}
