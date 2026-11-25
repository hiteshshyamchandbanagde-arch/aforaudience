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

// Actual show-end instant, combining Event.date with endTime and rolling
// to the next calendar day for the same overnight-wrap case
// formatEventTimeRange flags above. This is the single source of truth
// for "the show has ended" - the reputation epic's post-show rating
// prompt (§5), Hype Score's 2hr window (§4), and Audience Choice voting
// (§6) all anchor to this same instant, deliberately, for consistency
// across the whole system.
export function getEventEndDateTime(event: { date: Date; startTime: string; endTime: string }): Date {
  const [sh, sm] = event.startTime.split(':').map(Number)
  const [eh, em] = event.endTime.split(':').map(Number)
  const crossesMidnight = eh * 60 + em <= sh * 60 + sm

  const end = new Date(event.date)
  end.setHours(eh, em, 0, 0)
  if (crossesMidnight) end.setDate(end.getDate() + 1)
  return end
}

// Feedback cms9z2k6c (2 Aug) - Hitesh: a night-event indicator so users
// can tell at a glance an event starts late, without opening it.
// Threshold is 9pm (21:00) per his ask - startTime is 24hr "HH:MM"
// storage regardless of what the venue's own listing time convention
// looks like, so this is a plain hour comparison, no timezone/locale
// handling needed. Single source of truth so the events listing and
// detail page (and anywhere else this gets added later) agree on
// exactly the same cutoff.
export function isNightEvent(startTime: string): boolean {
  const [h] = startTime.split(':').map(Number)
  return h >= 21
}
