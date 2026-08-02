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
  // Scene Status thresholds (reputation epic §1, amended session 55) — see
  // src/lib/scene-status.ts for how these are consumed. Headliner has no
  // config here deliberately - fully manual, no formula.
  sceneStatusRisingMinGigs: number
  sceneStatusRisingMinAvgRating: number
  sceneStatusRisingMinAttendees: number
  sceneStatusFeaturedVouchThreshold: number
  // Admin artist roster (session 56) - how many of an artist's most recent
  // scored shows to average for the roster's Hype Score column.
  artistRosterHypeScoreLookback: number
  // Audience Choice voting defaults (§6, session 58)
  audienceVoteWeightDefault: number
  panelistVoteWeightDefault: number
  celebrityVoteWeightDefault: number
  // Event-creation forward window (Feedback cms9ynuxi, 2 Aug) - see
  // events/route.ts and events/[id]/route.ts for enforcement.
  eventCreationWindowMonths: number
}

const SINGLETON_ID = "singleton"

const SETTINGS_SELECT = {
  audienceBookingFee: true,
  minAudienceBookingFee: true,
  maxAudienceBookingFee: true,
  chatMaxMessagesPerSession: true,
  sceneStatusRisingMinGigs: true,
  sceneStatusRisingMinAvgRating: true,
  sceneStatusRisingMinAttendees: true,
  sceneStatusFeaturedVouchThreshold: true,
  artistRosterHypeScoreLookback: true,
  audienceVoteWeightDefault: true,
  panelistVoteWeightDefault: true,
  celebrityVoteWeightDefault: true,
  eventCreationWindowMonths: true,
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

/**
 * Admin-only setter for Scene Status's Rising and Featured thresholds
 * (reputation epic §1, amended session 55). Headliner has no setter here —
 * deliberately manual/admin-toggle-only, see Artist.isSceneStatusHeadliner.
 * All fields optional per call so a single-field PATCH doesn't reset the
 * others (same convention as setAudienceFeeSettings/setChatMaxMessagesPerSession).
 */
export async function setSceneStatusThresholds(input: {
  risingMinGigs?: number
  risingMinAvgRating?: number
  risingMinAttendees?: number
  featuredVouchThreshold?: number
}): Promise<PlatformSettings> {
  const data: Record<string, number> = {}

  if (input.risingMinGigs !== undefined) {
    if (!Number.isInteger(input.risingMinGigs) || input.risingMinGigs < 0) {
      throw new Error("sceneStatusRisingMinGigs must be a non-negative integer")
    }
    data.sceneStatusRisingMinGigs = input.risingMinGigs
  }
  if (input.risingMinAvgRating !== undefined) {
    if (!Number.isFinite(input.risingMinAvgRating) || input.risingMinAvgRating < 0 || input.risingMinAvgRating > 5) {
      throw new Error("sceneStatusRisingMinAvgRating must be between 0 and 5")
    }
    data.sceneStatusRisingMinAvgRating = input.risingMinAvgRating
  }
  if (input.risingMinAttendees !== undefined) {
    if (!Number.isInteger(input.risingMinAttendees) || input.risingMinAttendees < 0) {
      throw new Error("sceneStatusRisingMinAttendees must be a non-negative integer")
    }
    data.sceneStatusRisingMinAttendees = input.risingMinAttendees
  }
  if (input.featuredVouchThreshold !== undefined) {
    if (!Number.isInteger(input.featuredVouchThreshold) || input.featuredVouchThreshold < 1) {
      throw new Error("sceneStatusFeaturedVouchThreshold must be a positive integer")
    }
    data.sceneStatusFeaturedVouchThreshold = input.featuredVouchThreshold
  }

  const row = await prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    update: data,
    create: { id: SINGLETON_ID, ...data },
    select: SETTINGS_SELECT,
  })
  return row
}

/**
 * Admin-only setter for the artist roster's Hype Score lookback window
 * (session 56) - how many of an artist's most recent scored shows to
 * average on /dashboard/admin/artists. Separate from setSceneStatusThresholds
 * since this is a display/aggregation setting, not a tier-computation input.
 */
export async function setArtistRosterHypeScoreLookback(lookback: number): Promise<PlatformSettings> {
  if (!Number.isInteger(lookback) || lookback < 1) {
    throw new Error("artistRosterHypeScoreLookback must be a positive integer")
  }
  const row = await prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    update: { artistRosterHypeScoreLookback: lookback },
    create: { id: SINGLETON_ID, artistRosterHypeScoreLookback: lookback },
    select: SETTINGS_SELECT,
  })
  return row
}

/**
 * Admin-only setter for the Audience Choice voting default weights (§6,
 * session 58). Must sum to 100 and respect the design doc's ~50%
 * Audience floor - enforced here, same validation an organiser's
 * per-event override goes through (see events/[id]/route.ts).
 */
export async function setAudienceChoiceWeightDefaults(input: {
  audience: number
  panelist: number
  celebrity: number
}): Promise<PlatformSettings> {
  const { audience, panelist, celebrity } = input
  if (![audience, panelist, celebrity].every((n) => Number.isInteger(n) && n >= 0)) {
    throw new Error("Weights must be non-negative integers")
  }
  if (audience + panelist + celebrity !== 100) {
    throw new Error("Weights must sum to 100")
  }
  if (audience < 50) {
    throw new Error("Audience weight must be at least 50 (Audience Choice floor, per design)")
  }
  const row = await prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    update: { audienceVoteWeightDefault: audience, panelistVoteWeightDefault: panelist, celebrityVoteWeightDefault: celebrity },
    create: { id: SINGLETON_ID, audienceVoteWeightDefault: audience, panelistVoteWeightDefault: panelist, celebrityVoteWeightDefault: celebrity },
    select: SETTINGS_SELECT,
  })
  return row
}

/**
 * Admin-only setter for how many months out an organiser can create an
 * event without needing to contact admin first (Feedback cms9ynuxi, 2
 * Aug - Hitesh's own suggested default was 3). Capped at 24 months as a
 * sanity backstop against a fat-fingered value effectively disabling
 * the check.
 */
export async function setEventCreationWindowMonths(months: number): Promise<PlatformSettings> {
  if (!Number.isInteger(months) || months < 1) {
    throw new Error("eventCreationWindowMonths must be a positive integer")
  }
  if (months > 24) {
    throw new Error("eventCreationWindowMonths cannot exceed 24")
  }
  const row = await prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    update: { eventCreationWindowMonths: months },
    create: { id: SINGLETON_ID, eventCreationWindowMonths: months },
    select: SETTINGS_SELECT,
  })
  return row
}
