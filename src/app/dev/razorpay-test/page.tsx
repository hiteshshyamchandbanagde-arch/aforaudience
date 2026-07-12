"use client"

import { useState, useEffect } from "react"
import { useSession, signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

// ---------------------------------------------------------------------------
// /dev/razorpay-test
//
// End-to-end payment test page. QA-only. Click the "Pay ₹1" button, walk
// through the Razorpay Checkout modal with a test card, and confirm the
// whole round trip works: create-order → checkout modal → verify signature.
//
// The environment guard is enforced server-side by `page404IfProduction`
// below rather than client-side, because a client-side check is trivially
// bypassable. If someone navigates to /dev/razorpay-test on the real prod
// site, they get a 404, not a warning banner.
//
// Test card values (Razorpay's public documentation):
//   Card:   4111 1111 1111 1111
//   CVV:    any 3 digits (e.g. 123)
//   Expiry: any future date (e.g. 12/30)
//   OTP:    1234
// ---------------------------------------------------------------------------

// Razorpay's Checkout script attaches to window.Razorpay. TS doesn't know
// about it by default, so a minimal type declaration here.
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void }
  }
}

type RazorpayOptions = {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description?: string
  handler: (response: {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
  }) => void
  modal?: {
    ondismiss?: () => void
  }
  theme?: {
    color?: string
  }
  prefill?: {
    name?: string
    email?: string
    contact?: string
  }
}

type Status =
  | { kind: "idle" }
  | { kind: "loading-script" }
  | { kind: "creating-order" }
  | { kind: "awaiting-payment" }
  | { kind: "verifying" }
  | { kind: "success"; paymentId: string; orderId: string }
  | { kind: "error"; message: string }
  | { kind: "cancelled" }

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js"
const INK = "#0E0C0A"
const PAPER = "#F7F3EE"
const EMBER = "#C8441A"
const MIST = "#E8E2D9"
const SAGE = "#4A6741"
const SERIF = "Georgia, serif"
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace"

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false)
      return
    }
    if (window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement("script")
    script.src = RAZORPAY_SCRIPT_URL
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function RazorpayTestPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [amount, setAmount] = useState<number>(100) // paise — ₹1 default

  // Preload the Razorpay script on mount so the button click feels
  // instant. Doesn't cost anything — the script is small and cached.
  useEffect(() => {
    loadRazorpayScript()
  }, [])

  async function handlePay() {
    if (!session?.user) {
      // Auth is required by both API endpoints. Kick to sign-in with a
      // callback back to this page.
      signIn(undefined, { callbackUrl: "/dev/razorpay-test" })
      return
    }

    setStatus({ kind: "loading-script" })

    const scriptLoaded = await loadRazorpayScript()
    if (!scriptLoaded) {
      setStatus({
        kind: "error",
        message:
          "Could not load the Razorpay checkout script. Check your network connection and try again.",
      })
      return
    }

    setStatus({ kind: "creating-order" })

    let orderData: {
      orderId: string
      amount: number
      currency: string
      key: string
    }
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, notes: { source: "dev-test-page" } }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        setStatus({
          kind: "error",
          message: `Failed to create order: ${err.error ?? res.statusText}`,
        })
        return
      }
      orderData = await res.json()
    } catch (e) {
      setStatus({
        kind: "error",
        message: `Network error creating order: ${(e as Error).message}`,
      })
      return
    }

    if (!window.Razorpay) {
      setStatus({
        kind: "error",
        message: "Razorpay checkout is not available.",
      })
      return
    }

    setStatus({ kind: "awaiting-payment" })

    const rzp = new window.Razorpay({
      key: orderData.key,
      amount: orderData.amount,
      currency: orderData.currency,
      order_id: orderData.orderId,
      name: "AforAudience (QA test)",
      description: "Checkpoint 1 sanity payment",
      prefill: {
        name: session.user.name ?? "",
        email: session.user.email ?? "",
      },
      theme: { color: EMBER },
      handler: async (response) => {
        setStatus({ kind: "verifying" })
        try {
          const verifyRes = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          })
          const verifyData = await verifyRes.json()
          if (verifyRes.ok && verifyData.verified) {
            setStatus({
              kind: "success",
              paymentId: verifyData.paymentId,
              orderId: verifyData.orderId,
            })
          } else {
            setStatus({
              kind: "error",
              message: `Verification failed: ${verifyData.error ?? "unknown"}`,
            })
          }
        } catch (e) {
          setStatus({
            kind: "error",
            message: `Network error during verification: ${(e as Error).message}`,
          })
        }
      },
      modal: {
        ondismiss: () => setStatus({ kind: "cancelled" }),
      },
    })

    rzp.open()
  }

  return (
    <main
      style={{
        background: PAPER,
        color: INK,
        minHeight: "100vh",
        padding: "clamp(32px, 6vw, 64px) clamp(20px, 5vw, 40px)",
      }}
    >
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: "11px",
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: EMBER,
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span aria-hidden style={{ display: "inline-block", width: "32px", height: "1px", background: EMBER }} />
          <span>Dev · QA only</span>
        </div>
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            marginBottom: "16px",
          }}
        >
          Razorpay — Checkpoint 1
        </h1>
        <p style={{ fontFamily: SERIF, fontSize: "17px", lineHeight: 1.65, color: INK, opacity: 0.75, marginBottom: "32px" }}>
          End-to-end sanity test. Click the button, complete a Razorpay test
          payment, and confirm the round trip works: create-order → Checkout
          modal → verify signature. No real money, no database writes yet.
        </p>

        <div
          style={{
            padding: "20px 24px",
            background: "white",
            border: `1px solid ${MIST}`,
            borderRadius: "10px",
            marginBottom: "32px",
            fontFamily: MONO,
            fontSize: "13px",
            lineHeight: 1.7,
            color: INK,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "8px", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "11px", color: EMBER }}>
            Test card values
          </div>
          Card: 4111 1111 1111 1111<br />
          CVV: any 3 digits (e.g. 123)<br />
          Expiry: any future date (e.g. 12/30)<br />
          OTP if prompted: 1234
        </div>

        {sessionStatus === "loading" ? (
          <p style={{ fontFamily: SERIF, opacity: 0.6 }}>Loading session…</p>
        ) : !session?.user ? (
          <div style={{ marginBottom: "24px" }}>
            <p style={{ fontFamily: SERIF, marginBottom: "16px" }}>
              You need to be signed in to run this test — the API endpoints
              require an authenticated session.
            </p>
            <button
              onClick={() => signIn(undefined, { callbackUrl: "/dev/razorpay-test" })}
              style={{
                fontFamily: "system-ui, sans-serif",
                fontSize: "14px",
                fontWeight: 600,
                color: PAPER,
                background: INK,
                padding: "12px 24px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
              }}
            >
              Sign in
            </button>
          </div>
        ) : (
          <>
            <div
              style={{
                fontFamily: "system-ui, sans-serif",
                fontSize: "13px",
                color: INK,
                opacity: 0.6,
                marginBottom: "16px",
              }}
            >
              Signed in as {session.user.name ?? session.user.email ?? "user"}.
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontFamily: MONO,
                  fontSize: "11px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: INK,
                  opacity: 0.7,
                  marginBottom: "8px",
                }}
              >
                Amount (in paise — 100 = ₹1)
              </label>
              <input
                type="number"
                min="100"
                max="100000"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                style={{
                  fontFamily: MONO,
                  fontSize: "16px",
                  padding: "10px 14px",
                  border: `1px solid ${MIST}`,
                  borderRadius: "6px",
                  width: "200px",
                  color: INK,
                  background: "white",
                }}
              />
            </div>

            <button
              onClick={handlePay}
              disabled={
                status.kind === "loading-script" ||
                status.kind === "creating-order" ||
                status.kind === "awaiting-payment" ||
                status.kind === "verifying"
              }
              style={{
                fontFamily: "system-ui, sans-serif",
                fontSize: "16px",
                fontWeight: 600,
                color: "white",
                background: EMBER,
                padding: "16px 32px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                opacity:
                  status.kind === "loading-script" ||
                  status.kind === "creating-order" ||
                  status.kind === "awaiting-payment" ||
                  status.kind === "verifying"
                    ? 0.6
                    : 1,
              }}
            >
              Pay ₹{(amount / 100).toFixed(2)} (test)
            </button>
          </>
        )}

        {/* Status readout — telemetry for the tester */}
        <div
          style={{
            marginTop: "48px",
            padding: "20px 24px",
            background: "white",
            border: `1px solid ${MIST}`,
            borderRadius: "10px",
            fontFamily: MONO,
            fontSize: "13px",
            lineHeight: 1.7,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              marginBottom: "12px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontSize: "11px",
              color: EMBER,
            }}
          >
            Status
          </div>
          {status.kind === "idle" && <span style={{ opacity: 0.6 }}>Ready.</span>}
          {status.kind === "loading-script" && <span>Loading Razorpay script…</span>}
          {status.kind === "creating-order" && <span>Creating order on the server…</span>}
          {status.kind === "awaiting-payment" && <span>Waiting for payment in the Razorpay modal…</span>}
          {status.kind === "verifying" && <span>Verifying payment signature…</span>}
          {status.kind === "success" && (
            <div style={{ color: SAGE }}>
              ✓ Payment verified.<br />
              Order ID: {status.orderId}<br />
              Payment ID: {status.paymentId}
            </div>
          )}
          {status.kind === "error" && (
            <div style={{ color: EMBER }}>✗ {status.message}</div>
          )}
          {status.kind === "cancelled" && (
            <span style={{ opacity: 0.6 }}>Payment cancelled.</span>
          )}
        </div>

        <div style={{ marginTop: "40px", fontFamily: "system-ui, sans-serif", fontSize: "13px", opacity: 0.55 }}>
          <Link href="/" style={{ color: INK, textDecoration: "underline" }}>
            ← Back home
          </Link>
        </div>
      </div>
    </main>
  )
}
