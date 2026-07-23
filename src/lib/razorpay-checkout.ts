// ---------------------------------------------------------------------------
// Client-side helper for opening the Razorpay Checkout modal.
//
// Razorpay Checkout runs as a script loaded from checkout.razorpay.com,
// not as an npm package. This module wraps:
//   1. Loading the script tag (idempotent — safe to call multiple times).
//   2. Opening the modal with a given order + amount.
//   3. Bridging the Checkout callbacks back to a Promise the caller can await.
//
// Deliberately minimal — Razorpay's Checkout supports many options
// (prefill, theme, etc.) which we can layer on later. For MVP we just
// need the modal to open, take payment, and hand back the three values
// (order_id, payment_id, signature) our /confirm endpoint needs.
// ---------------------------------------------------------------------------

const CHECKOUT_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js"

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => { open: () => void }
  }
}

type RazorpayCheckoutOptions = {
  key: string
  amount: number // paise
  currency: string
  order_id: string
  name?: string
  description?: string
  prefill?: {
    name?: string
    email?: string
    contact?: string
  }
  theme?: {
    color?: string
  }
  handler: (response: {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
  }) => void
  modal?: {
    ondismiss?: () => void
    escape?: boolean
  }
}

/**
 * Injects the Razorpay Checkout script into the page. Safe to call
 * multiple times — checks if the script tag already exists, and if
 * `window.Razorpay` is already defined, resolves immediately.
 *
 * Rejects if the script fails to load (network error, CSP block, etc.)
 * so the caller can show a friendly error instead of a stuck modal.
 */
export function loadRazorpayCheckoutScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay Checkout can only load in the browser"))
  }
  if (window.Razorpay) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SCRIPT_URL}"]`
    )
    if (existing) {
      // Script tag already exists but hasn't finished loading yet — wait
      // for its load event rather than adding a second one.
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Razorpay Checkout")),
        { once: true }
      )
      return
    }

    const script = document.createElement("script")
    script.src = CHECKOUT_SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load Razorpay Checkout"))
    document.head.appendChild(script)
  })
}

export type CheckoutSuccess = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

export type CheckoutOpenParams = {
  keyId: string
  orderId: string
  amount: number // paise
  currency: string
  bookingId: string
  eventTitle: string
  prefill?: {
    name?: string
    email?: string
    contact?: string
  }
}

/**
 * Opens the Razorpay Checkout modal and resolves with the three signed
 * values on payment success. Rejects with a distinguishing error if the
 * user closes the modal without paying — the caller UI usually wants to
 * treat "dismissed" differently from "failed."
 *
 * Assumes loadRazorpayCheckoutScript() has already resolved. Call that
 * first (or the returned Promise will reject immediately).
 */
export function openRazorpayCheckout(
  params: CheckoutOpenParams
): Promise<CheckoutSuccess> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.Razorpay) {
      reject(new Error("Razorpay Checkout not loaded yet"))
      return
    }

    let settled = false

    const options: RazorpayCheckoutOptions = {
      key: params.keyId,
      amount: params.amount,
      currency: params.currency,
      order_id: params.orderId,
      name: "AforAudience",
      description: params.eventTitle,
      prefill: params.prefill,
      theme: { color: "var(--afa-terracotta)" }, // Ember, matches brand
      handler: (response) => {
        settled = true
        resolve(response)
      },
      modal: {
        escape: true,
        ondismiss: () => {
          if (!settled) {
            settled = true
            const err = new Error("Checkout dismissed") as Error & {
              code?: string
            }
            err.code = "DISMISSED"
            reject(err)
          }
        },
      },
    }

    try {
      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      reject(err instanceof Error ? err : new Error("Failed to open Checkout"))
    }
  })
}
