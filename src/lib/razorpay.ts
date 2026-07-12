import Razorpay from "razorpay"

// ---------------------------------------------------------------------------
// Razorpay client — single source of truth for how the SDK is initialized.
// All payment code imports the client from here rather than reading env
// vars or instantiating the SDK directly. That keeps three things in one
// place: which env vars we read, what happens when they're missing, and
// which key ID is safe to expose to the frontend (KEY_ID is, KEY_SECRET
// is never).
//
// Env vars expected (set in .env.local locally and Vercel Preview scope
// in QA — see the setup notes in the design doc's Razorpay dependency
// section):
//   - RAZORPAY_KEY_ID     (e.g. "rzp_test_XXXX" in QA, "rzp_live_XXXX"
//                          on prod once company registration clears)
//   - RAZORPAY_KEY_SECRET (server-only, must never leak client-side)
// ---------------------------------------------------------------------------

const KEY_ID = process.env.RAZORPAY_KEY_ID
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

/**
 * Are the credentials configured? Cheap check that doesn't hit the network.
 * Used by /api/debug/razorpay-check to distinguish "env vars missing" from
 * "env vars present but Razorpay unreachable" — the two need very different
 * fixes and shouldn't be conflated in a single error.
 */
export function razorpayCredentialsPresent(): boolean {
  return Boolean(KEY_ID && KEY_SECRET)
}

/**
 * The Razorpay Key ID, publicly safe to send to the frontend for rendering
 * the Checkout modal. NEVER return the secret from any API route. If the
 * ID is missing, return null so callers can respond with a clear error
 * instead of leaking `undefined` into a checkout URL.
 */
export function getPublicKeyId(): string | null {
  return KEY_ID || null
}

/**
 * The Razorpay Node SDK client, or null if credentials aren't configured.
 * Callers should check `razorpayCredentialsPresent()` first and return a
 * clear error response — reaching `getRazorpay()` and getting null means
 * the caller forgot to check.
 */
let cachedClient: Razorpay | null = null

export function getRazorpay(): Razorpay | null {
  if (!KEY_ID || !KEY_SECRET) return null
  if (!cachedClient) {
    cachedClient = new Razorpay({
      key_id: KEY_ID,
      key_secret: KEY_SECRET,
    })
  }
  return cachedClient
}

/**
 * The secret, used ONLY server-side to verify Razorpay's HMAC signature
 * after a successful payment (see /api/payments/verify). Never returned
 * from any API response, never logged, never sent to the browser.
 */
export function getKeySecretForSignatureVerification(): string | null {
  return KEY_SECRET || null
}
