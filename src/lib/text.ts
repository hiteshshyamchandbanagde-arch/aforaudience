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
// Three layers, in order:
//   1. NFKC Unicode normalization - folds compatibility-equivalent forms
//      (e.g. full-width "２" used by some IME/keyboard input methods)
//      into their canonical ASCII equivalents. AforAudience is
//      international, not India-only, so this can't assume ASCII input.
//   2. Strip invisible characters - zero-width space/joiners (U+200B-
//      U+200D) and BOM (U+FEFF) render as nothing but are distinct code
//      points, so "General\u200B2" would look identical to "General2"
//      on screen while comparing as a different string without this.
//   3. Strip ALL whitespace (not just collapse it) and lowercase - see
//      history below for why collapsing alone isn't enough.
//
// Two real bugs found live testing this: "General 2" vs "General    2"
// (extra internal spaces), and "General 2" vs "General2" (space present
// vs absent entirely) - both visually near-identical, both slipped past
// a naive `.trim().toLowerCase()`. Two names that read as "the same
// zone" to a human must not both save - the commercial risk is real:
// an organiser prices off the wrong "General 2" and audience seating
// gets misassigned.
export function normalizeForCompare(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}
