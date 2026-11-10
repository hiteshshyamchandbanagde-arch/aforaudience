// S1b-b2 (Hitesh, 9 Nov) - pure UI-side helpers for the launch wave
// "opening soon" states (W2 applications, W3 tickets, W4 paid B2B). No
// Prisma, no React: unit self-tested (scripts/launch-waves-ui.test.ts) and
// usable from both server and client components.
import { WAVE_CLOSED, WAVES, type Wave } from "@/lib/launch-waves"

export type WaveHint = Record<Wave, boolean>

/** All open - what an ADMIN viewer sees (they bypass every gate) and the
 * fallback while the client hint is still loading / failed to load (the
 * server still refuses, and the 403 mapping below catches it). */
export const ALL_WAVES_OPEN: WaveHint = { W1: true, W2: true, W3: true, W4: true }

/** The hint as this viewer should see it: ADMIN bypasses, same as the server. */
export function wavesForViewer(hint: Partial<WaveHint> | null | undefined, isAdmin: boolean): WaveHint {
  if (isAdmin || !hint) return { ...ALL_WAVES_OPEN }
  return {
    W1: hint.W1 !== false,
    W2: hint.W2 !== false,
    W3: hint.W3 !== false,
    W4: hint.W4 !== false,
  }
}

/** Dictionary keys under `launchWaves` for each wave's friendly line. */
export const WAVE_MESSAGE_KEY = {
  W1: "closedW1",
  W2: "closedW2",
  W3: "closedW3",
  W4: "closedW4",
} as const satisfies Record<Wave, string>

export type WaveMessageKey = (typeof WAVE_MESSAGE_KEY)[Wave]

/** The wave named in a `403 {code:"WAVE_CLOSED", wave}` body, else null. */
export function waveFromErrorBody(body: unknown): Wave | null {
  if (!body || typeof body !== "object") return null
  const b = body as { code?: unknown; wave?: unknown }
  if (b.code !== WAVE_CLOSED) return null
  return (WAVES as readonly unknown[]).includes(b.wave) ? (b.wave as Wave) : null
}

/**
 * Turns an API error body into the line to show. WAVE_CLOSED -> the
 * localized wave message (from `messages`, i.e. `tr.launchWaves`); anything
 * else -> its own `error` string, or `fallback` when there isn't one.
 */
export function waveErrorMessage(
  body: unknown,
  messages: Record<WaveMessageKey, string>,
  fallback: string
): string {
  const wave = waveFromErrorBody(body)
  if (wave) return messages[WAVE_MESSAGE_KEY[wave]]
  const err = body && typeof body === "object" ? (body as { error?: unknown }).error : undefined
  return typeof err === "string" && err.trim() ? err : fallback
}

/**
 * Event detail / seats: which "soon" state replaces the Book button.
 * W3 closed wins over paid-bookings-off (it's the broader one) and applies
 * to free and pay-at-entry events alike.
 */
export function bookingSoonState(input: { w3Open: boolean; paidPaused: boolean }): "W3" | "PAID" | null {
  if (!input.w3Open) return "W3"
  if (input.paidPaused) return "PAID"
  return null
}

/** W4: is this artist-slot payment type blocked? FREE never is. */
export function paymentTypeBlocked(paymentType: unknown, w4Open: boolean): boolean {
  if (w4Open) return false
  return paymentType === "PAID" || paymentType === "BUY_IN"
}

/** W4: is this venue booking amount blocked? Zero / blank never is. */
export function venueAmountBlocked(amount: unknown, w4Open: boolean): boolean {
  if (w4Open) return false
  const n = typeof amount === "number" ? amount : Number(amount)
  return Number.isFinite(n) && n > 0
}
