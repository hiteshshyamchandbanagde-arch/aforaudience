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

// Single source of truth for "Get Directions", used by both the public
// venue page and the read-only Google Maps Link field in the owner's
// create/edit forms - so the two never drift into showing different
// links for the same venue. Four tiers, most-precise first:
//   1. mapsUrl      - owner explicitly pasted a share link; they know
//                     best (e.g. a specific gate/entrance), always wins.
//   2. placeId       - Address was resolved via autocomplete; an exact
//                     named pin, not just a coordinate drop.
//   3. lat/lng       - legacy safety net, in case placeId is ever
//                     missing while coordinates exist.
//   4. address text  - always available (Address is a required field),
//                     so Get Directions never dead-ends even for a
//                     fully manually-typed venue with nothing pasted.
export function buildDirectionsUrl(venue: {
  mapsUrl?: string | null
  placeId?: string | null
  lat?: number | null
  lng?: number | null
  address?: string | null
  city?: string | null
}): string {
  if (venue.mapsUrl) return venue.mapsUrl
  if (venue.placeId) return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(venue.placeId)}`
  if (venue.lat != null && venue.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`
  }
  const addressText = [venue.address, venue.city].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`
}
