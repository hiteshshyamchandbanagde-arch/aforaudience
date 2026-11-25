import prisma from "@/lib/prisma"
import { getEventEndDateTime } from "@/lib/eventTime"
import { HYPE_SCORE_WINDOW_HOURS } from "@/lib/hype-score"
import { getPlatformSettings } from "@/lib/platform-settings"

// ---------------------------------------------------------------------------
// Audience Choice voting (reputation epic §6, session 58) - see
// docs/artist-reputation-system-design.md §6 for the full spec. Scoped to
// Competition Show events only (Event.isCompetitionShow).
//
// Voting window: opens the instant the show ends (getEventEndDateTime),
// closes HYPE_SCORE_WINDOW_HOURS later - reusing the same 2-hour duration
// Hype Score uses, per the doc's own "for consistency across the whole
// system" reasoning. This is reusing the NUMBER, not gating on Hype
// Score's own separate eligibility check - voting opens at show-end, not
// show-end+2hr.
//
// Counting: Borda 3/2/1 per category, normalized to a 0-100 scale within
// each category, then blended by organiser-set (or platform-default)
// weight. Normalization here is against the category's own theoretical
// maximum (voters-who-actually-voted × 3), not a min-max against the
// field's actual highest score - keeps the percentage meaning stable and
// category-independent ("how strongly this category favored the
// performer") rather than shifting with how contested the race was.
// ---------------------------------------------------------------------------

export type VoterCategory = "AUDIENCE" | "PANELIST" | "CELEBRITY"

export function getVotingWindow(event: { date: Date; startTime: string; endTime: string }) {
  const opensAt = getEventEndDateTime(event)
  const closesAt = new Date(opensAt.getTime() + HYPE_SCORE_WINDOW_HOURS * 60 * 60 * 1000)
  const now = Date.now()
  return {
    opensAt,
    closesAt,
    isOpen: now >= opensAt.getTime() && now < closesAt.getTime(),
    isClosed: now >= closesAt.getTime(),
  }
}

export async function resolveVoteWeights(event: {
  audienceVoteWeight: number | null
  panelistVoteWeight: number | null
  celebrityVoteWeight: number | null
}): Promise<{ audience: number; panelist: number; celebrity: number }> {
  if (event.audienceVoteWeight !== null && event.panelistVoteWeight !== null && event.celebrityVoteWeight !== null) {
    return { audience: event.audienceVoteWeight, panelist: event.panelistVoteWeight, celebrity: event.celebrityVoteWeight }
  }
  const settings = await getPlatformSettings()
  return {
    audience: event.audienceVoteWeight ?? settings.audienceVoteWeightDefault,
    panelist: event.panelistVoteWeight ?? settings.panelistVoteWeightDefault,
    celebrity: event.celebrityVoteWeight ?? settings.celebrityVoteWeightDefault,
  }
}

/**
 * Determines which category (or categories) a user can cast a ballot in
 * for a given event, and the voterId to use for each. A person can be
 * eligible in more than one category (e.g. an accepted panelist who also
 * bought a ticket) - these are role-based ballots, not mutually exclusive.
 */
export async function getVoterEligibility(eventId: string, userId: string) {
  const [audienceBookings, panelistEntry, celebrityEntry] = await Promise.all([
    prisma.booking.findMany({
      where: { eventId, userId, status: "CONFIRMED", checkedInAt: { not: null } },
      select: { id: true },
    }),
    prisma.eventPanelist.findFirst({ where: { eventId, userId, status: "ACCEPTED" } }),
    prisma.celebrity.findFirst({ where: { eventId, userId, status: "ACCEPTED" } }),
  ])

  return {
    audienceBookingIds: (audienceBookings as { id: string }[]).map((b) => b.id),
    isPanelist: !!panelistEntry,
    isCelebrity: !!celebrityEntry,
  }
}

/**
 * Full result computation for one event - raw Borda tallies per category,
 * normalized scores, effective (redistributed) weights, and the final
 * blended Audience Choice ranking. Live-computed on every call, no cache,
 * consistent with every other live-computed piece of this epic.
 */
export async function computeAudienceChoiceResults(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { audienceVoteWeight: true, panelistVoteWeight: true, celebrityVoteWeight: true },
  })
  if (!event) return null

  const weights = await resolveVoteWeights(event)

  const votes = await prisma.competitionVote.findMany({
    where: { eventId },
    select: { category: true, voterId: true, performanceId: true, rank: true },
  })

  const performances = await prisma.performance.findMany({
    where: { eventId, cancelledAt: null },
    select: { id: true, artist: { select: { user: { select: { name: true, displayName: true } } } } },
  })

  const categories: VoterCategory[] = ["AUDIENCE", "PANELIST", "CELEBRITY"]
  const rawByCategory: Record<VoterCategory, Map<string, number>> = { AUDIENCE: new Map(), PANELIST: new Map(), CELEBRITY: new Map() }
  const votersByCategory: Record<VoterCategory, Set<string>> = { AUDIENCE: new Set(), PANELIST: new Set(), CELEBRITY: new Set() }

  const RANK_POINTS: Record<number, number> = { 1: 3, 2: 2, 3: 1 }
  for (const v of votes) {
    const cat = v.category as VoterCategory
    votersByCategory[cat].add(v.voterId)
    const points = RANK_POINTS[v.rank] ?? 0
    rawByCategory[cat].set(v.performanceId, (rawByCategory[cat].get(v.performanceId) ?? 0) + points)
  }

  // Normalize each category to 0-100 against its own theoretical max
  // (actual voters in that category × 3) - a category with zero votes
  // cast has no theoretical max and is excluded entirely, not divided by
  // zero.
  const normalizedByCategory: Record<VoterCategory, Map<string, number>> = { AUDIENCE: new Map(), PANELIST: new Map(), CELEBRITY: new Map() }
  const categoryHasVotes: Record<VoterCategory, boolean> = { AUDIENCE: false, PANELIST: false, CELEBRITY: false }
  for (const cat of categories) {
    const voterCount = votersByCategory[cat].size
    if (voterCount === 0) continue
    categoryHasVotes[cat] = true
    const theoreticalMax = voterCount * 3
    for (const [performanceId, raw] of rawByCategory[cat].entries()) {
      normalizedByCategory[cat].set(performanceId, (raw / theoreticalMax) * 100)
    }
  }

  // Redistribute weight from empty categories proportionally into the
  // categories that do have votes - per the doc's guardrail, so an
  // event with no celebrity attending doesn't silently lose 10% of the
  // result to nobody.
  const rawWeights: Record<VoterCategory, number> = { AUDIENCE: weights.audience, PANELIST: weights.panelist, CELEBRITY: weights.celebrity }
  const activeCategories = categories.filter((c) => categoryHasVotes[c])
  const activeWeightSum = activeCategories.reduce((sum, c) => sum + rawWeights[c], 0)
  const effectiveWeights: Record<VoterCategory, number> = { AUDIENCE: 0, PANELIST: 0, CELEBRITY: 0 }
  if (activeWeightSum > 0) {
    for (const c of activeCategories) {
      effectiveWeights[c] = (rawWeights[c] / activeWeightSum) * 100
    }
  }

  type PerformanceRow = { id: string; artist: { user: { name: string; displayName: string | null } } }
  const blended = (performances as PerformanceRow[]).map((p) => {
    let score = 0
    for (const cat of categories) {
      const norm = normalizedByCategory[cat].get(p.id) ?? 0
      score += (norm * effectiveWeights[cat]) / 100
    }
    return {
      performanceId: p.id,
      artistName: p.artist.user.displayName || p.artist.user.name,
      blendedScore: Math.round(score * 10) / 10,
      byCategory: {
        AUDIENCE: Math.round((normalizedByCategory.AUDIENCE.get(p.id) ?? 0) * 10) / 10,
        PANELIST: Math.round((normalizedByCategory.PANELIST.get(p.id) ?? 0) * 10) / 10,
        CELEBRITY: Math.round((normalizedByCategory.CELEBRITY.get(p.id) ?? 0) * 10) / 10,
      },
    }
  })
  blended.sort((a, b) => b.blendedScore - a.blendedScore)

  return {
    ranking: blended,
    effectiveWeights: {
      AUDIENCE: Math.round(effectiveWeights.AUDIENCE * 10) / 10,
      PANELIST: Math.round(effectiveWeights.PANELIST * 10) / 10,
      CELEBRITY: Math.round(effectiveWeights.CELEBRITY * 10) / 10,
    },
    configuredWeights: weights,
    voterCounts: {
      AUDIENCE: votersByCategory.AUDIENCE.size,
      PANELIST: votersByCategory.PANELIST.size,
      CELEBRITY: votersByCategory.CELEBRITY.size,
    },
  }
}
