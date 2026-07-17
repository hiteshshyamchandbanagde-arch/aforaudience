// Shared input-format validators. Kept deliberately small — add here as
// new server-side format checks are needed, rather than duplicating
// regexes across API routes.

// Pragmatic email format check, not full RFC 5322. Good enough to catch
// the real-world failure mode we've seen (missing "@" slipping past
// HTML5 <input type="email"> when the browser-side check is bypassed —
// e.g. autofill, disabled JS, or a direct API call) without rejecting
// valid addresses. Deliberately does not attempt to validate TLDs,
// internationalized domains, or quoted local-parts.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmailFormat(email: string): boolean {
  return typeof email === "string" && EMAIL_RE.test(email)
}
