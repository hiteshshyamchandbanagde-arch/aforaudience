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

// BUG-2609-054 - the one username rule, shared by the register route,
// /api/auth/username-check and RegisterForm so the live check can never
// say "Available" for a name the server will then reject. 3-20 chars,
// ASCII letters/digits/underscore. Pure, so it's safe in client code.
export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

export function isValidUsernameFormat(username: string): boolean {
  return typeof username === "string" && USERNAME_RE.test(username)
}
