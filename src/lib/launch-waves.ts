// S1b-a (Hitesh, 9 Nov) - launch wave switches W1-W4. Go-live is staged by
// four admin switches on PlatformSettings; prod default all OFF and admin
// turns them on one at a time. Same shape as src/lib/paid-bookings.ts: no
// Prisma import, so unit self-tests and client components can use it. The
// DB read lives in platform-settings.ts (getLaunchWaves / launchWaveBlock).
//
//   W1 waveDiscoveryOpen      - new accounts (register, Google createUser)
//   W2 waveOnboardingOpen     - organiser / venue owner / artist applications
//   W3 waveTicketsOpen        - new audience reservations (POST /api/bookings)
//   W4 waveDirectBookingsOpen - creating PAID B2B bookings: a venue booking
//                               (request) with amount > 0, or a PAID / BUY_IN
//                               performance. FREE slots and zero-amount venue
//                               bookings stay with W2.
//
// ADMIN always bypasses (admin must be able to test on prod with waves
// closed). In-flight steps (accept / decline / paid / confirm / cancel /
// expiry) are never gated - only creation.

export const WAVE_CLOSED = "WAVE_CLOSED" as const

export const WAVES = ["W1", "W2", "W3", "W4"] as const
export type Wave = (typeof WAVES)[number]

export const WAVE_FLAG = {
  W1: "waveDiscoveryOpen",
  W2: "waveOnboardingOpen",
  W3: "waveTicketsOpen",
  W4: "waveDirectBookingsOpen",
} as const satisfies Record<Wave, string>

export type WaveFlagKey = (typeof WAVE_FLAG)[Wave]
export type LaunchWaveFlags = Record<WaveFlagKey, boolean>

export const WAVE_CLOSED_MESSAGE: Record<Wave, string> = {
  W1: "AforAudience is not open for new sign-ups yet. Please check back soon.",
  W2: "Applications to join as an organiser, venue or artist are not open yet. Please check back soon.",
  W3: "Ticket reservations are not open yet. Please check back soon.",
  W4: "Paid bookings between organisers, venues and artists are not open yet. Free slots can still be set up.",
}

export type WaveClosedBody = { error: string; code: typeof WAVE_CLOSED; wave: Wave }

/** True only when the setting is exactly true (missing row/column = closed). */
export function isWaveOpen(
  settings: Partial<LaunchWaveFlags> | null | undefined,
  wave: Wave
): boolean {
  return settings?.[WAVE_FLAG[wave]] === true
}

/** { W1, W2, W3, W4 } booleans - the public read hint shape. */
export function launchWaveHint(
  settings: Partial<LaunchWaveFlags> | null | undefined
): Record<Wave, boolean> {
  return {
    W1: isWaveOpen(settings, "W1"),
    W2: isWaveOpen(settings, "W2"),
    W3: isWaveOpen(settings, "W3"),
    W4: isWaveOpen(settings, "W4"),
  }
}

export function waveClosedBody(wave: Wave): WaveClosedBody {
  return { error: WAVE_CLOSED_MESSAGE[wave], code: WAVE_CLOSED, wave }
}

/**
 * The gate itself. Returns null when the request may go ahead, or the 403
 * body to send back when it must be refused.
 */
export function waveBlock(
  wave: Wave,
  open: boolean,
  isAdmin: boolean
): { status: 403; body: WaveClosedBody } | null {
  if (open || isAdmin) return null
  return { status: 403, body: waveClosedBody(wave) }
}

export function isAdminRole(role: unknown): boolean {
  return role === "ADMIN"
}

/** Thrown where a 403 body can't be returned directly (e.g. adapter.createUser). */
export class WaveClosedError extends Error {
  readonly code = WAVE_CLOSED
  readonly wave: Wave
  constructor(wave: Wave) {
    super(WAVE_CLOSED_MESSAGE[wave])
    this.name = "WaveClosedError"
    this.wave = wave
  }
}

/** W4 applies to a venue booking (request) only when money changes hands. */
export function venueBookingNeedsW4(amount: unknown): boolean {
  const n = typeof amount === "number" ? amount : Number(amount)
  return Number.isFinite(n) && n > 0
}

/** W4 applies to a performance only when it is PAID or BUY_IN (FREE is W2). */
export function performanceNeedsW4(paymentType: unknown): boolean {
  return paymentType === "PAID" || paymentType === "BUY_IN"
}
