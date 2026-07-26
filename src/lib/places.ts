// Server-only wrapper around Places API (New). The API key
// (GOOGLE_PLACES_API_KEY) never reaches the browser - every call here
// runs from our own API routes (src/app/api/places/*), matching how
// every other credential in this app (Razorpay, Resend) stays
// server-side rather than exposed via NEXT_PUBLIC_*.
//
// Session tokens: Google bills Autocomplete + the terminating Place
// Details call as one cheap "session" if the same token is used across
// the whole search-and-pick, instead of billing every keystroke
// individually. The token itself is just a client-generated UUID with
// no meaning to us - we pass it straight through.

const PLACES_API_BASE = 'https://places.googleapis.com/v1'

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured')
  }
  return key
}

export interface PlacePrediction {
  placeId: string
  mainText: string
  secondaryText: string
}

// City-level autocomplete only - includedPrimaryTypes restricts results
// to locality-shaped places (cities/towns), not businesses or streets,
// since this is only ever used for the venue's City field.
export async function autocompletePlaces(input: string, sessionToken: string): Promise<PlacePrediction[]> {
  const res = await fetch(`${PLACES_API_BASE}/places:autocomplete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': getApiKey(),
    },
    body: JSON.stringify({
      input,
      sessionToken,
      includedPrimaryTypes: ['locality', 'administrative_area_level_3'],
      // India-first, per this platform's current market - doesn't hard
      // exclude other countries, just biases ranking toward it.
      regionCode: 'IN',
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Places autocomplete failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : []
  return suggestions
    .filter((s: any) => s.placePrediction)
    .map((s: any) => ({
      placeId: s.placePrediction.placeId,
      mainText: s.placePrediction.structuredFormat?.mainText?.text ?? s.placePrediction.text?.text ?? '',
      secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text ?? '',
    }))
}

export interface PlaceLocation {
  city: string
  state: string | null
  country: string | null
  lat: number | null
  lng: number | null
}

// Terminates the Autocomplete session (billed as the cheap session
// rate, not per-keystroke) and resolves the picked place into
// structured city/state/country - what actually gets saved on Venue.
export async function getPlaceDetails(placeId: string, sessionToken: string): Promise<PlaceLocation> {
  const fieldMask = 'addressComponents,location'
  const res = await fetch(
    `${PLACES_API_BASE}/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`,
    {
      headers: {
        'X-Goog-Api-Key': getApiKey(),
        'X-Goog-FieldMask': fieldMask,
      },
    }
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Place details failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  const components: any[] = Array.isArray(data.addressComponents) ? data.addressComponents : []

  const find = (type: string) =>
    components.find((c) => Array.isArray(c.types) && c.types.includes(type))?.longText ?? null

  // Locality is the common case; some smaller towns only carry
  // administrative_area_level_3 instead - fall back to that so those
  // places don't come back with an empty city.
  const city = find('locality') ?? find('administrative_area_level_3') ?? find('administrative_area_level_2') ?? ''

  return {
    city,
    state: find('administrative_area_level_1'),
    country: find('country'),
    lat: data.location?.latitude ?? null,
    lng: data.location?.longitude ?? null,
  }
}
