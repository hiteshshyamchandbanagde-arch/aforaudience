// Run S2 (8 Nov) - SIGNUP_VERIFY must bind the phone to the account.
//
// /api/auth/otp/verify used to check the code for `phone` and then mark
// whatever `userId` the client sent as verified, so a valid code for phone
// A verified any other unverified account B. This helper is the route's
// whole decision, with the database calls passed in so the self-test
// (scripts/otp-signup-verify.test.ts) can run it without a database.
//
// Order, on purpose:
//   1. The account must exist and have exactly this phone on file. The
//      phone is compared as-is: lib/otp.ts keys OTP rows on the raw phone
//      string, and the register route stores phone.trim(), which is what
//      every client sends back (no extra normaliser here). A mismatch is
//      rejected BEFORE the code is checked, so a wrong pairing never
//      consumes, or burns an attempt on, the real owner's pending code.
//   2. The code is checked (and consumed) by verifyOtp.
//   3. The account is marked verified only where id AND phone still match,
//      in one statement; 0 rows updated is a reject.
//
// Every reject uses the same generic shape and message, so the response
// never says whether the account exists or which phone it has.

export const SIGNUP_VERIFY_GENERIC_ERROR = "Incorrect code."

export interface SignupVerifyDeps {
  /** The stored phone for this user id; null if there is no such user. */
  findUserPhone(userId: string): Promise<{ phone: string | null } | null>
  verifyOtp(phone: string, code: string): Promise<{ ok: boolean; error?: string }>
  /** Sets isVerified where id = userId AND phone = phone; returns rows updated. */
  markVerified(userId: string, phone: string): Promise<number>
}

export type SignupVerifyResult = { ok: true } | { ok: false; error: string }

export async function verifySignupOtp(
  input: { phone?: unknown; userId?: unknown; code?: unknown },
  deps: SignupVerifyDeps
): Promise<SignupVerifyResult> {
  const { phone, userId, code } = input
  if (typeof phone !== "string" || typeof userId !== "string" || typeof code !== "string" || !phone || !userId || !code) {
    return { ok: false, error: "phone, userId and code are required." }
  }

  const user = await deps.findUserPhone(userId)
  if (!user || !user.phone || user.phone !== phone) {
    return { ok: false, error: SIGNUP_VERIFY_GENERIC_ERROR }
  }

  const result = await deps.verifyOtp(phone, code)
  if (!result.ok) {
    return { ok: false, error: result.error ?? SIGNUP_VERIFY_GENERIC_ERROR }
  }

  const updated = await deps.markVerified(userId, phone)
  if (updated === 0) {
    return { ok: false, error: SIGNUP_VERIFY_GENERIC_ERROR }
  }
  return { ok: true }
}
