import { isValidUsernameFormat } from "@/lib/validation"

// Run C item 1 (Hitesh phone pass, 13-14 Oct) - suggestions used to
// include "tq" (under 3 characters) and "tq.matinee" (a dot), which the
// register route then rejects. Every candidate here now goes through
// isValidUsernameFormat (src/lib/validation.ts, the same rule the field
// is checked against on submit) before it's even looked up, and if that
// leaves too few, more valid ones are generated. Kept free of Prisma so
// scripts/username-suggestions.test.ts can run it without a database;
// auth-helpers passes in the real availability check.

// On-brand word bank for the initials-suggestion upgrade - live
// performance/theatre vocabulary, kept generic (no protected terms), so
// suggestions feel like *this* platform's signup rather than a plain
// initials string. Purely cosmetic pairing with the initials seed - adds
// no identity information, so it doesn't reopen the session-39 /
// cmse195bc1e27d60e27596011 privacy reasoning.
export const THEME_WORDS = [
  "backstage", "spotlight", "encore", "curtaincall", "houselights",
  "matinee", "greenroom", "showtime", "onstage", "standingovation",
  "openmic", "frontrow",
]

export const SUGGESTION_COUNT = 3
const MAX_LENGTH = 20

/** Lowercase ASCII letters/digits only; "user" when nothing Latin is left (e.g. a Devanagari name). */
export function usernameBase(seed: string): string {
  return seed.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, MAX_LENGTH) || "user"
}

function shuffled<T>(arr: T[], random: () => number): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function withSuffix(base: string, suffix: string): string {
  return `${base.slice(0, MAX_LENGTH - suffix.length)}${suffix}`
}

/**
 * Up to SUGGESTION_COUNT varied, de-identified options from an initials
 * seed: plain, a numbered variant, and a brand-flavored variant pairing
 * the initials with a theme word ("tq_matinee"). Randomized picks so the
 * client's "try more" control gets a genuinely different set most of the
 * time. Every returned name passes isValidUsernameFormat and isAvailable,
 * with no duplicates (case-insensitive, as availability is).
 */
export async function generateUsernameVariants(
  seed: string,
  isAvailable: (name: string) => Promise<boolean>,
  random: () => number = Math.random,
): Promise<string[]> {
  const base = usernameBase(seed)
  const variants: string[] = []
  const seen = new Set<string>()

  const tryAdd = async (candidate: string) => {
    const key = candidate.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    if (!isValidUsernameFormat(candidate)) return false
    if (!(await isAvailable(candidate))) return false
    variants.push(candidate)
    return true
  }

  // 1. Plain initials (skipped by the validator when shorter than 3).
  await tryAdd(base)

  // 2. Initials + a short random number (bounded retries, not sequential
  // 1/2/3 - a random pick reads less like an auto-incrementing counter).
  for (let attempt = 0; attempt < 5 && variants.length < 2; attempt++) {
    await tryAdd(withSuffix(base, String(Math.floor(random() * 90) + 10)))
  }

  // 3. Initials + a random theme word, joined with "_" (a dot isn't
  // allowed in a username).
  for (const word of shuffled(THEME_WORDS, random)) {
    if (variants.length >= SUGGESTION_COUNT) break
    if (await tryAdd(withSuffix(base, `_${word}`))) break
  }

  // 4. Filtering (or taken names) left fewer than usual: top up with
  // longer numbers rather than show fewer.
  for (let attempt = 0; attempt < 20 && variants.length < SUGGESTION_COUNT; attempt++) {
    await tryAdd(withSuffix(base, String(Math.floor(random() * 9000) + 100)))
  }

  return variants
}
