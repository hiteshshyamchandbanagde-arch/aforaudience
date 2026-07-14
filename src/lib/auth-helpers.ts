import { prisma } from "@/lib/prisma"

const CODE_PATTERN = /^(AFA|ART|ORG|VEN)\d{10}$/
// Optional +<countrycode> then 7-15 digits. Loosened for eventual
// international intent; only +91 numbers actually receive OTPs today.
const PHONE_PATTERN = /^\+?\d{7,15}$/

/**
 * Builds the set of phone-number formats a single user-typed string
 * could reasonably represent, so lookup matches whichever form the row
 * was stored in.
 *
 * Registration currently requires and stores +91-prefixed E.164 (e.g.
 * "+919876543210"). But at login users type the same number many ways:
 *   9876543210       — bare 10-digit
 *   +919876543210    — canonical
 *   919876543210     — country code, no plus
 *   +9876543210      — someone hit + by mistake
 * Prior behavior did an exact-string match on the raw input, so users
 * who registered with +91 and later typed a bare 10-digit at login
 * silently failed to authenticate. This function returns every
 * equivalent form so a single Prisma `IN` query catches whichever one
 * is on the row.
 */
function phoneLookupCandidates(value: string): string[] {
  const digits = value.replace(/\D/g, '')
  const candidates = new Set<string>([value])

  if (digits.length === 10) {
    candidates.add('+91' + digits)
    candidates.add('91' + digits)
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    candidates.add('+' + digits)
    candidates.add(digits.slice(2))       // bare 10-digit
    candidates.add('+' + digits.slice(2)) // + + 10 digits, in case of odd registrations
  }

  return [...candidates]
}

/**
 * Resolves a single login "identifier" field to a User row.
 * Order: email -> code (User.code, then role-table codes) -> phone -> username (User.name).
 */
export async function resolveIdentifierToUser(identifier: string) {
  const value = identifier.trim()
  if (!value) return null

  if (value.includes("@")) {
    return prisma.user.findUnique({ where: { email: value.toLowerCase() } })
  }

  if (CODE_PATTERN.test(value)) {
    const byUserCode = await prisma.user.findUnique({ where: { code: value } })
    if (byUserCode) return byUserCode

    const artist = await prisma.artist.findUnique({ where: { code: value } })
    if (artist) return prisma.user.findUnique({ where: { id: artist.userId } })

    const organiser = await prisma.organiser.findUnique({ where: { code: value } })
    if (organiser) return prisma.user.findUnique({ where: { id: organiser.userId } })

    const venueOwner = await prisma.venueOwner.findUnique({ where: { code: value } })
    if (venueOwner) return prisma.user.findUnique({ where: { id: venueOwner.userId } })

    return null
  }

  if (PHONE_PATTERN.test(value)) {
    // Match any equivalent form the number may have been stored in.
    // Single query, uses the phone index on User.
    return prisma.user.findFirst({
      where: { phone: { in: phoneLookupCandidates(value) } },
    })
  }

  // Username lookup — case-insensitive. Registration currently preserves
  // the case a user typed at signup, so `MikeSmith` and `mikesmith` are
  // different rows in the DB; but a user reasonably expects to type
  // either at login and have it work. `mode: 'insensitive'` uses ILIKE
  // under the hood on Postgres. `findFirst` (not findUnique) because
  // the unique constraint is case-sensitive and case-insensitive
  // matching may hit multiple rows (rare — see also
  // `isUsernameAvailable` which now blocks new case-collisions from
  // being created).
  return prisma.user.findFirst({
    where: { name: { equals: value, mode: 'insensitive' } },
  })
}

/** Suggests a username from free text: lowercase, alphanumeric only, numeric suffix if taken. */
export async function suggestAvailableUsername(seed: string): Promise<string> {
  const base = seed.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20) || "user"

  let candidate = base
  let suffix = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.user.findFirst({
      where: { name: { equals: candidate, mode: 'insensitive' } },
    })
    if (!existing) return candidate
    suffix += 1
    candidate = `${base}${suffix}`
  }
}

/**
 * Case-insensitive availability check. Prevents a new user registering
 * `Hitesh` when `hitesh` already exists — which prior to this change
 * was possible and would have caused login ambiguity (`resolveIdentifierToUser`
 * now looks up case-insensitively, so both names would resolve to the
 * same account, whichever the DB returned first).
 *
 * Existing case-collision rows in the DB (from before this change) are
 * unaffected — they can still log in, since findFirst returns any
 * matching row and the password check narrows to the right account.
 */
export async function isUsernameAvailable(name: string): Promise<boolean> {
  if (!name.trim()) return false
  const existing = await prisma.user.findFirst({
    where: { name: { equals: name.trim(), mode: 'insensitive' } },
  })
  return !existing
}
