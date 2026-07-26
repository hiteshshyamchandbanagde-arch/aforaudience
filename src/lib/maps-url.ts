// The previous check only verified the value was *a* syntactically valid
// http(s) URL (new URL() + protocol check) - which let nonsense through,
// e.g. "https:\\GARBAGEVALUE" parses cleanly per the WHATWG URL spec
// (backslash treated like slash for special schemes) even though
// "garbagevalue" isn't a real domain. This adds a real domain allowlist
// on top of the existing syntax check, covering every Google Maps
// share-link host actually in use (full maps.google.com links, the
// maps.app.goo.gl / goo.gl short-link forms, and g.page business links).
const ALLOWED_HOSTS = ['google.com', 'goo.gl', 'g.page']

export function isValidMapsUrl(raw: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(raw.trim())
  } catch {
    return false
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return false
  const host = parsed.hostname.toLowerCase()
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
}
