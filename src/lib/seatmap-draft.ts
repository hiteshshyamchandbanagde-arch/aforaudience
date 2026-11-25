// BUG-2609-086 - when the Seat Map Builder offers back its localStorage
// draft (key `afa-seatmap-draft:<venueId>`), and how it names the draft's
// age. A 10-day-old draft was offered as "from 14998 minutes ago ...
// likely from an accidental refresh": it was neither. Now:
//   - a frozen map never offers a draft (it is read-only);
//   - a draft older than 24 h is stale, not an accidental refresh;
//   - a draft older than the server's last save is superseded;
//   - an empty draft has nothing to offer.
// In every one of those cases the draft is discarded silently.

export const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000

export type DraftDecision = 'offer' | 'discard'

export function draftDecision(
  draft: { savedAt: number; seatCount: number },
  ctx: { now: number; frozen: boolean; serverSavedAt: number | null },
): DraftDecision {
  if (ctx.frozen) return 'discard'
  if (draft.seatCount <= 0) return 'discard'
  if (!Number.isFinite(draft.savedAt)) return 'discard'
  if (ctx.now - draft.savedAt > DRAFT_MAX_AGE_MS) return 'discard'
  if (ctx.serverSavedAt !== null && draft.savedAt <= ctx.serverSavedAt) return 'discard'
  return 'offer'
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`

/** "just now", "5 minutes ago", "3 hours ago", "10 days ago". */
export function humaniseAge(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return plural(minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return plural(hours, 'hour')
  return plural(Math.floor(hours / 24), 'day')
}
