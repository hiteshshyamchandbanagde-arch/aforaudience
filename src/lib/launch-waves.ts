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

// ---------------------------------------------------------------------------
// S1b-b1 - W1 holding page. While W1 (discovery + sign-up) is closed, a
// non-admin visitor to "/" or a public discovery route sees an "opening
// soon" page instead. Everything else - login/password/verify pages, legal
// pages, /about, /contact, /dashboard/**, /api/**, static/PWA files and
// /.well-known/** - stays reachable. Held routes are an explicit list (not
// "everything except"), so a route nobody thought about is never held by
// accident.

/** Route prefixes held while W1 is closed. "/" is matched exactly. */
export const W1_HELD_PREFIXES = [
  "/events",
  "/artists",
  "/organisers",
  "/tours",
  "/venue-owners",
  "/wall-of-fame",
  "/venues",
  "/blog",
  "/livestreams",
  "/for-artists",
  "/careers",
] as const

/** Strips query/hash and trailing slashes ("/events/" -> "/events", "" -> "/"). */
export function normalisePathname(pathname: string): string {
  const bare = (pathname || "/").split(/[?#]/)[0]
  const trimmed = bare.replace(/\/+$/, "")
  return trimmed === "" ? "/" : trimmed
}

/** True when the path is the homepage or under a held discovery prefix. */
export function isW1HeldPath(pathname: string): boolean {
  const p = normalisePathname(pathname)
  if (p === "/") return true
  return W1_HELD_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + "/"))
}

/**
 * Should this request get the "opening soon" holding page instead of the
 * real page? Only when W1 is closed, the viewer isn't ADMIN, and the path
 * is a held discovery route.
 */
export function holdingPageApplies(pathname: string, w1Open: boolean, isAdmin: boolean): boolean {
  if (w1Open || isAdmin) return false
  return isW1HeldPath(pathname)
}

// ---------------------------------------------------------------------------
// S1b-b1-fix - the holding check runs in src/proxy.ts (not in layouts), so
// public pages stay static/ISR. The proxy's matcher must be a static
// literal (Next rule), so it can't import this list; the self-test
// (scripts/launch-waves-proxy.test.ts) checks the two are equal.

/** Static route the proxy rewrites held requests to (noindex). */
export const LAUNCHING_SOON_PATH = "/launching-soon"

/** The proxy matcher this list implies: "/" exactly, then each prefix and below. */
export function w1ProxyMatcher(): string[] {
  return ["/", ...W1_HELD_PREFIXES.map((p) => `${p}/:path*`)]
}

export type W1ProxyAction = "next" | "rewrite"

/**
 * The proxy's decision. readW1Open() is the (cached) switch read; a failed
 * read counts as open (display courtesy, never blank the site on a DB
 * blip). readIsAdmin() is only called when W1 is closed and the path is
 * held, so the open path costs one cached read and nothing else.
 */
export async function w1ProxyAction(
  pathname: string,
  deps: { readW1Open: () => Promise<boolean>; readIsAdmin: () => Promise<boolean> },
  request: { prerenderRevalidate?: string | null; previewModeId?: string } = {}
): Promise<W1ProxyAction> {
  // S1b-c1 - an ISR revalidation/prerender request (Next sends
  // PRERENDER_REVALIDATE_HEADER "x-prerender-revalidate", with the build's
  // preview-mode id as its value) must regenerate the REAL page: it carries
  // no session, so rewriting it would store the holding page as "/"'s
  // prerender and serve it to everyone, admins included.
  if (isPrerenderRevalidate(request)) return "next"
  if (!isW1HeldPath(pathname)) return "next"
  let w1Open: boolean
  try {
    w1Open = await deps.readW1Open()
  } catch {
    return "next"
  }
  if (w1Open) return "next"
  let isAdmin = false
  try {
    isAdmin = await deps.readIsAdmin()
  } catch {
    isAdmin = false
  }
  return holdingPageApplies(pathname, w1Open, isAdmin) ? "rewrite" : "next"
}

/** Name of Next's ISR revalidation header (next/dist/lib/constants). */
export const PRERENDER_REVALIDATE_HEADER = "x-prerender-revalidate"

/**
 * True for an ISR revalidation request. When the build's preview-mode id is
 * known, the header must equal it (a visitor can't spoof it to skip the
 * holding page); when it isn't exposed to the proxy, presence is enough
 * (worst case a crafted request sees public pages early).
 */
export function isPrerenderRevalidate(request: {
  prerenderRevalidate?: string | null
  previewModeId?: string
}): boolean {
  const v = request.prerenderRevalidate
  if (!v) return false
  return request.previewModeId ? v === request.previewModeId : true
}

/**
 * A tiny per-instance TTL cache for one async value. Errors are not cached
 * (the next call retries). `now` is injectable for the self-test.
 */
export function ttlCached<T>(fetcher: () => Promise<T>, ttlMs: number, now: () => number = Date.now) {
  let value: T | undefined
  let expires = 0
  let has = false
  return {
    async get(): Promise<T> {
      const t = now()
      if (has && t < expires) return value as T
      const v = await fetcher()
      value = v
      has = true
      expires = t + ttlMs
      return v
    },
    clear() {
      has = false
      expires = 0
    },
  }
}
