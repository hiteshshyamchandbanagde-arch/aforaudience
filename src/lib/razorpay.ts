import Razorpay from "razorpay"
import crypto from "crypto"

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

/**
 * The webhook secret Razorpay uses to sign webhook events. Set separately
 * from KEY_SECRET (Razorpay dashboard: Settings → Webhooks → Add webhook,
 * then copy the generated secret to RAZORPAY_WEBHOOK_SECRET in the env).
 *
 * Returns null if unset — the webhook endpoint fails closed in that case
 * rather than silently accepting unsigned events, which would let anyone
 * on the internet POST a fake "payment.captured" and confirm bookings.
 */
export function getWebhookSecret(): string | null {
  return process.env.RAZORPAY_WEBHOOK_SECRET || null
}

// ---------------------------------------------------------------------------
// Higher-level helpers used by /api/bookings, /api/bookings/[id]/confirm,
// and /api/payments/webhook. Extracted from the Checkpoint 1 endpoints so
// the same code path is used everywhere — no HMAC or order-creation logic
// duplicated across routes where a subtle divergence could quietly break
// verification.
// ---------------------------------------------------------------------------

export type CreateOrderResult = {
  orderId: string
  amount: number
  currency: string
  keyId: string
}

/**
 * Creates a Razorpay order. Throws if credentials are missing (callers
 * should check razorpayCredentialsPresent() first) or if the Razorpay
 * API call fails. Returns just the fields the frontend needs to open
 * Checkout — never returns raw SDK objects, which contain internal
 * fields we don't want to leak.
 *
 * `amount` must be in paise (integer). Caller is responsible for
 * validating range; this function trusts what it's given.
 *
 * `notes` shows up in the Razorpay dashboard alongside the order. Good
 * place for a bookingId or userId — no length cap and searchable.
 */
export async function createRazorpayOrder(params: {
  amount: number
  currency?: string
  notes?: Record<string, string>
  receiptPrefix?: string
}): Promise<CreateOrderResult> {
  const client = getRazorpay()
  const keyId = getPublicKeyId()
  if (!client || !keyId) {
    throw new Error("Razorpay is not configured")
  }

  // Razorpay's `receipt` field has a hard 40-char limit and rejects longer
  // strings with input_validation_failed. Short random ID keeps us well
  // under the cap; real identifying info goes into `notes`.
  const prefix = (params.receiptPrefix ?? "afa").slice(0, 8)
  const receipt = `${prefix}_${crypto.randomBytes(8).toString("hex")}` // 8+1+16 = ≤25 chars

  const order = await client.orders.create({
    amount: params.amount,
    currency: params.currency ?? "INR",
    receipt,
    notes: params.notes ?? {},
  })

  return {
    orderId: order.id,
    amount: typeof order.amount === "string" ? parseInt(order.amount, 10) : (order.amount as number),
    currency: order.currency,
    keyId,
  }
}

/**
 * Verifies a Razorpay payment signature using timing-safe comparison.
 * Returns true if the signature is authentic (i.e. this really came
 * from Razorpay, not a forged callback), false otherwise.
 *
 * Deliberately does not throw — a bad signature is a normal outcome
 * that the caller should handle as "reject this payment," not as an
 * exceptional error.
 *
 * Returns false (not throws) if the secret isn't configured — the
 * caller should have checked credentials first, and treating "not
 * configured" the same as "bad signature" is the safe default.
 */
export function verifyPaymentSignature(params: {
  orderId: string
  paymentId: string
  signature: string
}): boolean {
  const secret = getKeySecretForSignatureVerification()
  if (!secret) return false

  // Basic shape validation — not security-critical (the HMAC below is)
  // but rejects obvious junk without crypto work.
  if (
    typeof params.orderId !== "string" ||
    typeof params.paymentId !== "string" ||
    typeof params.signature !== "string" ||
    !/^[a-f0-9]{64}$/.test(params.signature)
  ) {
    return false
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex")

  const providedBuf = Buffer.from(params.signature, "hex")
  const expectedBuf = Buffer.from(expected, "hex")

  return (
    providedBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(providedBuf, expectedBuf)
  )
}

/**
 * Verifies a Razorpay webhook signature. Same HMAC scheme as payments,
 * but the input is the raw request body and the secret is the webhook
 * secret (set separately from the API key secret).
 *
 * Must be called with the RAW request body bytes/string — parsing to
 * JSON first and re-stringifying changes byte order and breaks the HMAC.
 */
export function verifyWebhookSignature(params: {
  rawBody: string
  signature: string
}): boolean {
  const secret = getWebhookSecret()
  if (!secret) return false
  if (typeof params.signature !== "string" || !/^[a-f0-9]{64}$/.test(params.signature)) {
    return false
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(params.rawBody)
    .digest("hex")

  const providedBuf = Buffer.from(params.signature, "hex")
  const expectedBuf = Buffer.from(expected, "hex")

  return (
    providedBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(providedBuf, expectedBuf)
  )
}
