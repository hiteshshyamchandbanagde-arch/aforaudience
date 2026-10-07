// FEAT-2608-036 follow-up. Venue.country stores the full name as returned
// by Google Places Details (e.g. "India", "United States") - this maps
// that to the 2-letter code used in city labels like "Pune (IN)". Covers
// current QA data's spread (India/Australia/Japan/Singapore/Canada/US/
// UK/UAE) plus a broader set of common countries so this doesn't need
// another edit the next time a new country shows up. Unknown names fall
// back to null (label just omits the code rather than showing "undefined").
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'India': 'IN',
  'Australia': 'AU',
  'Japan': 'JP',
  'Singapore': 'SG',
  'Canada': 'CA',
  'United States': 'US',
  'United States of America': 'US',
  'United Kingdom': 'GB',
  'United Arab Emirates': 'AE',
  'Germany': 'DE',
  'France': 'FR',
  'Spain': 'ES',
  'Italy': 'IT',
  'Netherlands': 'NL',
  'Switzerland': 'CH',
  'Sweden': 'SE',
  'Norway': 'NO',
  'Denmark': 'DK',
  'Ireland': 'IE',
  'New Zealand': 'NZ',
  'South Africa': 'ZA',
  'Brazil': 'BR',
  'Mexico': 'MX',
  'Indonesia': 'ID',
  'Malaysia': 'MY',
  'Thailand': 'TH',
  'Philippines': 'PH',
  'Vietnam': 'VN',
  'South Korea': 'KR',
  'China': 'CN',
  'Sri Lanka': 'LK',
  'Nepal': 'NP',
  'Bangladesh': 'BD',
  'Pakistan': 'PK',
  'Saudi Arabia': 'SA',
  'Qatar': 'QA',
  'Kuwait': 'KW',
  'Oman': 'OM',
  'Bahrain': 'BH',
}

export function countryCode(countryName: string | null | undefined): string | null {
  if (!countryName) return null
  // Already a 2-letter code (e.g. from Vercel's x-vercel-ip-country
  // header on a freshly IP-detected location, before the person has
  // ever picked from the city list) - use it directly rather than
  // failing the full-name lookup below and silently dropping it.
  if (/^[A-Z]{2}$/.test(countryName)) return countryName
  return COUNTRY_NAME_TO_CODE[countryName] ?? null
}

export function cityLabel(city: string, countryName: string | null | undefined): string {
  const code = countryCode(countryName)
  return code ? `${city} (${code})` : city
}

// GEN-2610-005 - the one format the LocationChip shows, for the chip and
// every row in its picker. An IP-detected city often arrives with no
// country (or a different spelling of it) while a picked one carries
// "India", so the chip read "PUNE" for one and "JAIPUR (IN)" for the
// other. Indian cities are now always the bare name (AFA's home market,
// and "(IN)" also squeezed the 390 top bar); a city abroad keeps its
// code, "Sydney (AU)". A city with no known country reads as bare too,
// the same as an Indian one.
const HOME_COUNTRY_CODE = 'IN'

export function chipCityLabel(city: string, countryName: string | null | undefined): string {
  const code = countryCode(countryName)
  return code && code !== HOME_COUNTRY_CODE ? `${city} (${code})` : city
}
