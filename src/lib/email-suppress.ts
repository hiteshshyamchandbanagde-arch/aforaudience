// Load test (28 Nov 2026) - test accounts must never reach Resend. QA sends
// on the same mail.aforaudience.com domain as prod, so mail to made-up
// addresses would bounce and hurt prod's sender reputation. These domains
// never belong to real users, so the check applies in every environment.
// Exact domain match only: subdomains and look-alikes are NOT suppressed.
//
// Pure module (no imports) so scripts/email-suppress.test.ts can run
// without DATABASE_URL; src/lib/email.ts builds a Prisma client on import.
export const SUPPRESSED_TEST_EMAIL_DOMAINS = [
  "loadtest.aforaudience.qa", // load-test runner accounts
  "aforaudience.qa", // QA personas
  "example.com", // e2e fixtures
] as const

export function recipientDomain(to: string): string | null {
  const t = to.trim()
  const at = t.lastIndexOf("@")
  return at < 0 ? null : t.slice(at + 1).toLowerCase()
}

export function isSuppressedTestRecipient(to: string): boolean {
  const domain = recipientDomain(to)
  return domain !== null && (SUPPRESSED_TEST_EMAIL_DOMAINS as readonly string[]).includes(domain)
}
