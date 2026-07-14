import { NextResponse } from "next/server"
import crypto from "crypto"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  getRazorpay,
  razorpayCredentialsPresent,
  getPublicKeyId,
} from "@/lib/razorpay"

// ---------------------------------------------------------------------------
// POST /api/payments/create-order
//
// Creates a Razorpay order and returns the details the frontend needs to
// open the Razorpay Checkout modal. This is Checkpoint 1's "real" endpoint
// — it makes actual (test-mode) calls to Razorpay and produces real order
// IDs that Razorpay's servers know about.
//
// Body:
//   {
//     amount: number,       // in PAISE, not rupees (Razorpay convention)
//                           // e.g. ₹1 = 100, ₹299 = 29900
//     currency?: string,    // defaults to "INR"
//     notes?: {             // optional key-value pairs shown in Razorpay
//       [key: string]: string   // dashboard for the order — useful for
//     }                     // linking a payment back to a booking later
//   }
//
// Response:
//   {
//     orderId: string,      // pass to Razorpay Checkout as `order_id`
//     amount: number,       // echoed back for confirmation
//     currency: string,
//     key: string           // public key ID — safe to expose, needed by
//                           // the Checkout modal to identify the merchant
//   }
//
// Requires an authenticated user. Not because payment data is user-specific
// yet (Checkpoint 2 will connect this to real bookings), but because an
// unauthenticated endpoint that creates Razorpay orders is a free spam
// vector for any bot that finds the URL.
//
// Deliberately does NOT write to the database yet — that's Checkpoint 2's
// job. Right now this is purely a Razorpay round-trip.
// ---------------------------------------------------------------------------

type CreateOrderBody = {
  amount?: unknown
  currency?: unknown
  notes?: unknown
}

export async function POST(request: Request) {
  // 1. Auth check first — cheap, no external calls.
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { error: "Sign in to create a payment order." },
      { status: 401 }
    )
  }

  // 2. Credentials check second — also cheap. Distinguishes "not
  // configured" from "configured but call failed" which are very
  // different errors from an ops perspective.
  if (!razorpayCredentialsPresent()) {
    return NextResponse.json(
      {
        error:
          "Payments are not configured on this environment. Contact support.",
      },
      { status: 503 }
    )
  }

  // 3. Parse and validate the body. Explicit input validation — never
  // trust that the frontend sent what we expect. Razorpay accepts amounts
  // up to ~₹5 crore (5_00_00_000 * 100 = 5e10 paise) but for MVP we cap
  // at ₹1 lakh — no legitimate ticket booking should exceed this, so a
  // higher amount is almost certainly a bug or an abuse attempt.
  let body: CreateOrderBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    )
  }

  const amount = Number(body.amount)
  if (!Number.isInteger(amount) || amount < 100 || amount > 100_00_000) {
    // 100 paise = ₹1 minimum (Razorpay won't accept less);
    // 100_00_000 paise = ₹1 lakh maximum for MVP sanity.
    return NextResponse.json(
      {
        error:
          "Amount must be an integer number of paise between 100 (₹1) and 10000000 (₹1,00,000).",
      },
      { status: 400 }
    )
  }

  const currency = typeof body.currency === "string" ? body.currency : "INR"
  if (currency !== "INR") {
    // Razorpay supports other currencies but our whole platform is INR
    // for now — reject anything else so we don't accidentally create a
    // USD order and get confused later.
    return NextResponse.json(
      { error: "Only INR is supported at this time." },
      { status: 400 }
    )
  }

  // Notes are optional. If present, must be a flat object with string
  // values (Razorpay's own constraint).
  let notes: Record<string, string> | undefined
  if (body.notes && typeof body.notes === "object" && !Array.isArray(body.notes)) {
    notes = {}
    for (const [k, v] of Object.entries(body.notes as Record<string, unknown>)) {
      if (typeof v === "string" && v.length <= 256) {
        notes[k] = v
      }
    }
  }

  // 4. Make the actual Razorpay API call.
  const client = getRazorpay()
  if (!client) {
    return NextResponse.json(
      { error: "Payment service unavailable." },
      { status: 503 }
    )
  }

  try {
    // Razorpay's `receipt` field has a hard 40-character limit (validated
    // server-side; requests over the limit fail with input_validation_failed).
    // We use a short random ID here purely as a client-side reference for
    // the order — the actual "who is this user, what booking is this for"
    // context goes into `notes` below, which has no length restriction and
    // appears alongside the order in the Razorpay dashboard.
    //
    // Format: "chk1_" (5) + 16 hex chars (from 8 random bytes) = 21 chars.
    // Well under the 40-char cap with room for a future prefix change.
    const receipt = `chk1_${crypto.randomBytes(8).toString("hex")}`

    const userId = (session.user as any).id
    const userIdShort = typeof userId === "string" ? userId.slice(0, 40) : "anon"

    const order = await client.orders.create({
      amount,
      currency,
      receipt,
      notes: notes ?? {
        checkpoint: "1",
        purpose: "test-payment",
        // Notes field has no strict length cap and is where any tracking
        // metadata belongs — Razorpay stores it alongside the order in the
        // dashboard. Truncated for defense-in-depth against oversized values.
        userId: userIdShort,
      },
    })

    return NextResponse.json(
      {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: getPublicKeyId(),
      },
      { status: 200 }
    )
  } catch (err) {
    // Log server-side (Vercel captures this) but never echo the raw error
    // to the client — Razorpay error messages can contain the key ID or
    // other internal details we don't want in browser network tabs.
    console.error("[create-order] Razorpay error:", err)
    return NextResponse.json(
      { error: "Failed to create payment order. Please try again." },
      { status: 502 }
    )
  }
}
