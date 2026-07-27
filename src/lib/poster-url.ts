// Session 39 (Feedback ec6e4adf) - shared by both poster generation
// routes so the QR/link target is computed identically in one place.
export function publicEventUrl(eventId: string): string {
  const base = process.env.NEXTAUTH_URL || 'https://qa.aforaudience.com'
  return `${base.replace(/\/$/, '')}/events/${eventId}`
}
