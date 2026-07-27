// Whitespace normalization for user-typed names (seat-map zones, GA
// sections, venue levels). `.trim()` alone only strips leading/trailing
// whitespace - it does NOT collapse internal whitespace, so "General 2"
// and "General    2" (extra internal spaces) trim to two different
// strings and slip past a naive `.trim().toLowerCase()` duplicate check.
// Live-observed 27 Jul: 4 GA sections including "general 2" (single
// space) and "general    2" (multiple spaces) all passed validation and
// reached Publish as visually-indistinguishable "duplicates."
export function normalizeWhitespace(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

// Case- and whitespace-insensitive key for duplicate-name comparisons.
export function normalizeForCompare(s: string): string {
  return normalizeWhitespace(s).toLowerCase()
}
