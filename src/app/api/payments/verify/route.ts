import { NextResponse } from "next/server"
import crypto from "crypto"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  razorpayCredentialsPresent,
  getKeySecretForSignatureVerification,
} from "@/lib/razorpay"

// ---------------------------------------------------------------------------
// POST /api/payments/verify
//
// Verifies a Razorpay payment signature. This is the single security-
// critical endpoint of Checkpoint 1. Without correct verification, any
// user could fake a "payment successful" callback client-side (by simply
// making up an order_id and payment_id) and get whatever we grant on
// successful payment — a free ticket, in Checkpoint 2's world.
//
// How Razorpay's signature scheme works:
//   1. When a payment succeeds in the Checkout modal, Razorpay's client-
//      side JS returns three values to the frontend:
//        - razorpay_order_id     (matches the id we got from create-order)
//        - razorpay_payment_id   (Razorpay's ID for the actual payment)
//        - razorpay_signature    (an HMAC-SHA256 of `${order_id}|${payment_id}`
//                                 keyed on our KEY_SECRET)
//   2. Only Razorpay's server and our own server know the KEY_SECRET, so
//      only the two of us can compute that HMAC. If we recompute it and
//      it matches the signature the frontend sent, the payment is real.
//   3. Anyone else would need to know KEY_SECRET to forge a valid signature,
//      and KEY_SECRET never leaves the server.
//
// The comparison must be timing-safe (crypto.timingSafeEqual) to prevent
// side-channel attacks where an attacker measures how long the comparison
// takes to guess characters of the signature one at a time.
//
// Checkpoint 1 only returns { verified: true/false }. Checkpoint 2 will
// hook this to actual booking confirmation — mark the booking CONFIRMED,
// release the seats reservation to actual purchase, generate the PDF
// ticket, and so on.
// ---------------------------------------------------------------------------

type VerifyBody = {
  razorpay_order_id?: unknown
  razorpay_payment_id?: unknown
  razorpay_signature?: unknown
}

export async function POST(request: Request) {
  // 1. Auth check — same reasoning as create-order. Verifying an anonymous
  // payment doesn't make sense; if the user isn't logged in, they can't
  // have anything to grant on success anyway.
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { error: "Sign in to verify a payment." },
      { status: 401 }
    )
  }

  // 2. Credentials check.
  if (!razorpayCredentialsPresent()) {
    return NextResponse.json(
      { error: "Payments are not configured on this environment." },
      { status: 503 }
    )
  }

  // 3. Parse body.
  let body: VerifyBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    )
  }

  const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : ""
  const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : ""
  const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature : ""

  if (!orderId || !paymentId || !signature) {
    return NextResponse.json(
      {
        error:
          "Missing required fields. Send razorpay_order_id, razorpay_payment_id, and razorpay_signature.",
      },
      { status: 400 }
    )
  }

  // Basic shape validation — Razorpay IDs follow "order_XXXXX" and
  // "pay_XXXXX" prefixes, signatures are 64 hex chars. These aren't
  // security-relevant (the HMAC check below is) but they let us reject
  // obvious junk without doing the crypto work.
  if (!orderId.startsWith("order_") || !paymentId.startsWith("pay_")) {
    return NextResponse.json(
      { error: "Malformed order or payment ID." },
      { status: 400 }
    )
  }
  if (!/^[a-f0-9]{64}$/.test(signature)) {
    return NextResponse.json(
      { error: "Malformed signature." },
      { status: 400 }
    )
  }

  // 4. Compute the expected signature. This is the actual security check.
  const secret = getKeySecretForSignatureVerification()
  if (!secret) {
    // Should be impossible after razorpayCredentialsPresent() check, but
    // TypeScript can't know that.
    return NextResponse.json(
      { error: "Payment service unavailable." },
      { status: 503 }
    )
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex")

  // 5. Timing-safe comparison. Both buffers must be the same length or
  // timingSafeEqual throws — we already validated signature is 64 hex
  // chars above so this is safe.
  const providedBuffer = Buffer.from(signature, "hex")
  const expectedBuffer = Buffer.from(expectedSignature, "hex")

  const verified =
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer)

  if (!verified) {
    // Deliberately generic response. Don't reveal WHY it failed (wrong
    // length? wrong hex? mismatched HMAC?) — that's information leakage
    // that helps an attacker refine forgery attempts.
    return NextResponse.json(
      { verified: false, error: "Payment verification failed." },
      { status: 400 }
    )
  }

  // 6. Verified. Return the payment ID as a receipt for the frontend to
  // show; Checkpoint 2 will do the real work here (mark booking as paid,
  // generate PDF, send email, etc.)
  return NextResponse.json(
    {
      verified: true,
      paymentId,
      orderId,
    },
    { status: 200 }
  )
}
