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
  return COUNTRY_NAME_TO_CODE[countryName] ?? null
}

export function cityLabel(city: string, countryName: string | null | undefined): string {
  const code = countryCode(countryName)
  return code ? `${city} (${code})` : city
}
