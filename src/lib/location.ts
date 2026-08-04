import type { cookies as cookiesFn, headers as headersFn } from 'next/headers'

export const LOCATION_COOKIE = 'afa_loc'
const MANUAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90 // 90 days - deliberate user choice, should stick
const DETECTED_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 // 1 day - unconfirmed IP-geo guess, should re-check soon

// BUG-2608-044. v2 gave every cookie the same 90-day life regardless of
// where it came from, so a single first-visit IP-geo guess got treated
// exactly like a deliberate pick and could outlive the device actually
// moving somewhere else for up to 3 months. v3 adds `manual` to the
// payload: true only when the user explicitly chose a city via
// LocationChip's picker (POST). Auto-detected guesses (GET's
// write-back) are now stored with manual:false and a short TTL, and -
// per resolveLocation below - are eligible to be silently replaced by
// a fresh IP-geo read on any later request, since they were never a
// real choice to begin with.
//
// Self-caught (2 Aug, right after shipping the country field): a cookie
// written before `country` existed just... kept winning over re-detection
// forever, since cookie beats fresh IP-geo in the precedence order below.
// Any future schema change to what this cookie stores would hit the same
// silent-stale-forever bug. Bumping this version forces old cookies to be
// treated as absent (falls through to fresh detection) instead of trusted
// as-is - bump it again the next time this shape changes.
const LOCATION_COOKIE_VERSION = 3

export interface ResolvedLocation {
  city: string | null
  lat: number | null
  lng: number | null
  country: string | null
  // 'profile'   - logged-in user has an explicit User.defaultCity saved
  // 'cookie'    - previously detected/chosen, stored client-side
  // 'detected'  - first-touch guess from Vercel's edge geo headers this request
  // 'none'      - nothing available (e.g. local dev with no geo headers, first-ever guest hit)
  source: 'profile' | 'cookie' | 'detected' | 'none'
}

interface ParsedCookie {
  city: string
  lat: number | null
  lng: number | null
  country: string | null
  manual: boolean
}

function parseCookie(raw: string | undefined): ParsedCookie | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    // No `v` at all, or an old version = pre-v3 cookie - deliberately NOT
    // accepted even if it otherwise looks usable, so a schema change
    // always gets a chance to re-run detection rather than being masked
    // by an old cache hit.
    if (parsed?.v !== LOCATION_COOKIE_VERSION) return null
    if (typeof parsed?.city === 'string' && parsed.city) {
      return {
        city: parsed.city,
        lat: typeof parsed.lat === 'number' ? parsed.lat : null,
        lng: typeof parsed.lng === 'number' ? parsed.lng : null,
        country: typeof parsed.country === 'string' ? parsed.country : null,
        manual: parsed.manual === true,
      }
    }
  } catch {
    // malformed cookie value - ignore, fall through to detection
  }
  return null
}

// Vercel sets these on every request at the edge - no external API call,
// no billing, city-level only (not GPS-precise). Empty in local dev.
// City comes URI-encoded (e.g. "Pune" or "New%20Delhi"). Country comes
// as a 2-letter ISO code (e.g. "IN") - doesn't match Venue.country's
// full-name format ("India"), but countryCode() in country-codes.ts
// passes an already-2-letter code straight through, so this still
// renders correctly as "Pune (IN)" without needing a name lookup here.
function detectFromVercelHeaders(headerStore: Awaited<ReturnType<typeof headersFn>>): { city: string; lat: number | null; lng: number | null; country: string | null } | null {
  const rawCity = headerStore.get('x-vercel-ip-city')
  if (!rawCity) return null
  const city = decodeURIComponent(rawCity)
  const lat = parseFloat(headerStore.get('x-vercel-ip-latitude') || '')
  const lng = parseFloat(headerStore.get('x-vercel-ip-longitude') || '')
  const country = headerStore.get('x-vercel-ip-country') || null
  return { city, lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null, country }
}

// Precedence: explicit profile choice > deliberate cookie pick > fresh
// IP-geo guess > stale (non-manual) cookie guess > nothing.
//
// A non-manual cookie (an old auto-detect write-back) is treated as
// provisional: if this request's fresh IP-geo read disagrees with it,
// the fresh read wins and is reported with source 'detected' so the
// caller (route.ts GET) re-persists it, keeping the guess current as a
// device actually moves. If fresh detection isn't available this
// request (local dev, no geo headers), the stale guess is used as a
// last resort rather than dropping to 'none'.
//
// Only call this server-side (route handlers / server components) - it
// reads cookies()/headers().
export async function resolveLocation(opts: {
  profileCity?: string | null
  profileLat?: number | null
  profileLng?: number | null
  profileCountry?: string | null
  cookieStore: Awaited<ReturnType<typeof cookiesFn>>
  headerStore: Awaited<ReturnType<typeof headersFn>>
}): Promise<ResolvedLocation> {
  const { profileCity, profileLat, profileLng, profileCountry, cookieStore, headerStore } = opts

  if (profileCity) {
    return { city: profileCity, lat: profileLat ?? null, lng: profileLng ?? null, country: profileCountry ?? null, source: 'profile' }
  }

  const fromCookie = parseCookie(cookieStore.get(LOCATION_COOKIE)?.value)

  if (fromCookie?.manual) {
    return { city: fromCookie.city, lat: fromCookie.lat, lng: fromCookie.lng, country: fromCookie.country, source: 'cookie' }
  }

  const detected = detectFromVercelHeaders(headerStore)
  if (detected) {
    return { ...detected, source: 'detected' }
  }

  if (fromCookie) {
    // Non-manual cookie, but no fresh geo headers this request (e.g.
    // local dev) - fall back to the provisional guess rather than 'none'.
    return { city: fromCookie.city, lat: fromCookie.lat, lng: fromCookie.lng, country: fromCookie.country, source: 'cookie' }
  }

  return { city: null, lat: null, lng: null, country: null, source: 'none' }
}

export function locationCookieValue(city: string, lat: number | null, lng: number | null, country: string | null, manual: boolean): string {
  return JSON.stringify({ v: LOCATION_COOKIE_VERSION, city, lat, lng, country, manual })
}

export const MANUAL_LOCATION_COOKIE_OPTIONS = {
  maxAge: MANUAL_COOKIE_MAX_AGE_SECONDS,
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
}

export const DETECTED_LOCATION_COOKIE_OPTIONS = {
  maxAge: DETECTED_COOKIE_MAX_AGE_SECONDS,
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
}
