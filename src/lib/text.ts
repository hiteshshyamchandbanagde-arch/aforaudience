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
// Strips ALL whitespace, not just collapses runs of it - collapsing
// alone still leaves "General 2" (one space) and "General2" (zero
// spaces) as two different keys, and live-tested 27 Jul that's exactly
// the pair that got through: an audience member sees no meaningful
// difference between "General 2" and "General2." Whitespace-count is
// not a meaningful naming distinction here, so it's removed entirely
// for comparison (the stored/displayed name itself is untouched -
// see normalizeWhitespace above for that).
export function normalizeForCompare(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase()
}
