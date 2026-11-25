// GEN-2609-042 - single source of truth for "is the onboarding welcome
// sequence currently due for this user, on this page." Shared between
// WelcomeSequence.tsx (which renders the takeover when this is true) and
// NudgeStack.tsx (which suppresses itself when this is true, so nothing
// stacks under the takeover) - kept in one place rather than duplicated
// in both so the two conditions can never drift apart.
//
// Same excluded-path convention as PhoneVerifyNudge/NotificationOptIn:
// never interrupt an in-progress auth/checkout/verify-phone/admin flow
// with the takeover, even though a genuinely new user's first
// authenticated page load should never land on one of these directly.
const EXCLUDED_PATH_PREFIXES = ['/auth', '/checkout', '/verify-phone', '/api', '/admin']

export function isOnboardingSequenceDue(
  onboardedAt: string | Date | null | undefined,
  pathname: string | null
): boolean {
  if (onboardedAt) return false
  if (pathname) {
    for (const prefix of EXCLUDED_PATH_PREFIXES) {
      if (pathname.startsWith(prefix)) return false
    }
  }
  return true
}
