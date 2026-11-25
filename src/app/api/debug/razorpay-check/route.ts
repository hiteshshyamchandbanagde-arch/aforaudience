import { NextResponse } from "next/server"
import {
  getRazorpay,
  razorpayCredentialsPresent,
  getPublicKeyId,
} from "@/lib/razorpay"
import { isProductionEnv } from "@/lib/env-guard"

// ---------------------------------------------------------------------------
// GET /api/debug/razorpay-check
//
// Sanity endpoint used exactly once per environment to confirm that the
// Razorpay integration can talk to Razorpay. Returns a structured JSON
// describing what's configured and what actually worked, without ever
// echoing the secret.
//
// Distinguishes three failure modes on purpose, because they need
// different fixes and shouldn't be conflated:
//   1. Env vars missing            → set them in Vercel + local .env.local
//   2. Env vars present, API fails → wrong key, revoked, or network issue
//   3. Everything works            → we're good, move on to real integration
//
// QA-only. 404 in production — this endpoint reveals configuration state
// that has no business being on the public prod site.
// ---------------------------------------------------------------------------

export async function GET() {
  // Prod guard first, before any other logic. If someone hits this URL on
  // production we want to look identical to any other 404, no hints that
  // the route exists at all.
  if (isProductionEnv()) {
    return new NextResponse("Not Found", { status: 404 })
  }

  // Step 1 — are the env vars even set? Cheap, no network.
  if (!razorpayCredentialsPresent()) {
    return NextResponse.json(
      {
        ok: false,
        stage: "credentials",
        message:
          "Razorpay credentials are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.local (locally) and in Vercel's Preview environment (QA).",
      },
      { status: 500 }
    )
  }

  const keyId = getPublicKeyId()
  // The prefix is safe to show — it tells us at a glance whether QA is
  // running test mode ("rzp_test_") or accidentally live mode ("rzp_live_").
  // We show the first 12 chars, no more, so the actual key can't be
  // reconstructed from the response.
  const keyIdPrefix = keyId ? keyId.slice(0, 12) + "..." : null

  const client = getRazorpay()
  if (!client) {
    // Should be impossible if razorpayCredentialsPresent() returned true,
    // but keeps TypeScript happy and covers the "someone deleted an env
    // var between check and use" edge case.
    return NextResponse.json(
      {
        ok: false,
        stage: "client-init",
        message: "Failed to initialize the Razorpay client.",
      },
      { status: 500 }
    )
  }

  // Step 2 — actually hit Razorpay's API to prove the credentials work
  // against their servers, not just that they're syntactically present.
  // Fetching a single order is the cheapest authenticated call available;
  // it doesn't create anything, doesn't move money, and fails fast if
  // credentials are wrong.
  try {
    const orders = await client.orders.all({ count: 1 })
    return NextResponse.json(
      {
        ok: true,
        keyIdPrefix,
        keyMode: keyId?.startsWith("rzp_live_") ? "live" : "test",
        canReachRazorpay: true,
        // Not the actual order data — just a sign of life. Never echo
        // real order details from a debug endpoint.
        receivedResponseFromRazorpay: true,
        totalOrdersReturned: orders.items?.length ?? 0,
      },
      { status: 200 }
    )
  } catch (err) {
    // Razorpay SDK error surface is a plain Error with a message; safe to
    // include the message but never the stack trace or the request body
    // (which could contain the key on some code paths).
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      {
        ok: false,
        stage: "api-call",
        keyIdPrefix,
        keyMode: keyId?.startsWith("rzp_live_") ? "live" : "test",
        canReachRazorpay: false,
        message,
      },
      { status: 500 }
    )
  }
}
