// BUG-2609-073 - the dashboard badges (DashboardShell's useBadgeCounts)
// are fetched once per page. A page that changes what they count (accept,
// counter or decline a Flexible request) calls this so they refetch at
// once instead of after a reload.
export const BADGE_REFRESH_EVENT = 'afa:badge-counts-refresh'

export function refreshBadgeCounts() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(BADGE_REFRESH_EVENT))
}
