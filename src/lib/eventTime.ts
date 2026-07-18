// Overnight shows (e.g. 9:09 PM - 11:01 AM) store startTime > endTime and
// wrap past midnight by design (see the events API route's +24h duration
// calc for FLEXIBLE venues) - shown plainly, that reads as a backwards or
// broken time range. This flags it as next-day instead.
export function formatEventTimeRange(startTime: string, endTime: string): string {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const crossesMidnight = eh * 60 + em <= sh * 60 + sm
  return crossesMidnight ? `${startTime} – ${endTime} (next day)` : `${startTime} – ${endTime}`
}
