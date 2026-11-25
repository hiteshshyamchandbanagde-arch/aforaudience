// Session 39 (Feedback ec6e4adf) - shared by both poster generation
// routes so the QR/link target is computed identically in one place.
//
// BUG-2610-023 - the link is built from the origin the poster was
// requested on (the deployment serving it), not NEXTAUTH_URL: on QA that
// still named the old aforaudience.vercel.app host. NEXTAUTH_URL is only
// the fallback when a request carries no host at all.
export function requestOrigin(req: Request): string | null {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  if (host) {
    const proto = req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(/:$/, '')
    return `${proto.split(',')[0].trim()}://${host.split(',')[0].trim()}`
  }
  try {
    return new URL(req.url).origin
  } catch {
    return null
  }
}

export function publicEventUrl(eventId: string, req?: Request): string {
  const base = (req && requestOrigin(req)) || process.env.NEXTAUTH_URL || 'https://qa.aforaudience.com'
  return `${base.replace(/\/$/, '')}/events/${eventId}`
}
