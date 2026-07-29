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
  audienceBookingFee: number // paise — the "standard" default, prefilled at checkout
  minAudienceBookingFee: number // paise — floor an audience member can drop the fee to
  maxAudienceBookingFee: number // paise — per-transaction ceiling (standard fee + overrides both bounded by this)
  chatMaxMessagesPerSession: number
}

const SINGLETON_ID = "singleton"

const SETTINGS_SELECT = {
  audienceBookingFee: true,
  minAudienceBookingFee: true,
  maxAudienceBookingFee: true,
  chatMaxMessagesPerSession: true,
} as const

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const row = await prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID, audienceBookingFee: 0 },
    select: SETTINGS_SELECT,
  })
  return row
}

/**
 * Absolute code-level ceiling (₹500 = 50000 paise), deploy-gated. No
 * admin-set value — min, standard, or max — may ever exceed this,
 * regardless of what's typed into the settings page. This is the
 * sanity backstop; the admin-configurable band below it is what
 * actually governs checkout day to day. Bump deliberately, on purpose,
 * with a new deploy, if that ever needs to change.
 */
export const MAX_BOOKING_FEE_PAISE = 50000

/**
 * Admin-only setter for the full fee band (29 Jul — min/standard/max
 * replace the old single-value fee). All three are validated together
 * as one unit because they only make sense as a triple: min ≤ standard
 * ≤ max ≤ MAX_BOOKING_FEE_PAISE. Rejecting an inconsistent triple
 * outright (rather than clamping) keeps this in line with the same
 * "reject bad money inputs, don't silently reinterpret them" rule the
 * audience-side override already follows.
 */
export async function setAudienceFeeSettings(input: {
  minPaise: number
  standardPaise: number
  maxPaise: number
}): Promise<PlatformSettings> {
  const { minPaise, standardPaise, maxPaise } = input
  for (const [label, v] of [
    ["minAudienceBookingFee", minPaise],
    ["audienceBookingFee", standardPaise],
    ["maxAudienceBookingFee", maxPaise],
  ] as const) {
    if (!Number.isInteger(v) || v < 0) {
      throw new Error(`${label} must be a non-negative integer (paise)`)
    }
    if (v > MAX_BOOKING_FEE_PAISE) {
      throw new Error(
        `${label} cannot exceed ${MAX_BOOKING_FEE_PAISE} paise (₹${MAX_BOOKING_FEE_PAISE / 100})`
      )
    }
  }
  if (!(minPaise <= standardPaise && standardPaise <= maxPaise)) {
    throw new Error("Fee band must satisfy min ≤ standard ≤ max")
  }
  const row = await prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    update: {
      minAudienceBookingFee: minPaise,
      audienceBookingFee: standardPaise,
      maxAudienceBookingFee: maxPaise,
    },
    create: {
      id: SINGLETON_ID,
      minAudienceBookingFee: minPaise,
      audienceBookingFee: standardPaise,
      maxAudienceBookingFee: maxPaise,
    },
    select: SETTINGS_SELECT,
  })
  return row
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
    select: SETTINGS_SELECT,
  })
  return row
}
