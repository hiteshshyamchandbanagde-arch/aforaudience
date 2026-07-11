import { prisma } from "@/lib/prisma"

const CODE_PATTERN = /^(AFA|ART|ORG|VEN)\d{10}$/
// Optional +<countrycode> then 7-15 digits. Loosened for eventual
// international intent; only +91 numbers actually receive OTPs today.
const PHONE_PATTERN = /^\+?\d{7,15}$/

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
    return prisma.user.findFirst({ where: { phone: value } })
  }

  return prisma.user.findUnique({ where: { name: value } })
}

/** Suggests a username from free text: lowercase, alphanumeric only, numeric suffix if taken. */
export async function suggestAvailableUsername(seed: string): Promise<string> {
  const base = seed.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20) || "user"

  let candidate = base
  let suffix = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.user.findUnique({ where: { name: candidate } })
    if (!existing) return candidate
    suffix += 1
    candidate = `${base}${suffix}`
  }
}

export async function isUsernameAvailable(name: string): Promise<boolean> {
  if (!name.trim()) return false
  const existing = await prisma.user.findUnique({ where: { name: name.trim() } })
  return !existing
}
