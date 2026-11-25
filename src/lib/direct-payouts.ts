// Direct Payouts (Razorpay Route) - session 65. Route is unavailable on
// this account tier; this flag gates the pre-pivot linking UI/API. Lazy
// expiry check, no cron: if directPayoutsEnabledUntil is set and has
// passed, treat as disabled even though the bool is still true in the
// DB. Callers just call this on every read - nothing self-heals the DB
// row, which is fine since the check is cheap and always re-run.
//
// BUG-2609-051 - its own file (no Prisma import) so the admin Settings
// page can show the same effective state the API uses; the page used to
// read the raw bool and showed a lapsed flag as ON.

export type DirectPayoutsFlag = {
  directPayoutsEnabled: boolean
  // A Date from Prisma, an ISO string from the settings API.
  directPayoutsEnabledUntil: Date | string | null
}

export function isDirectPayoutsEnabled(settings: DirectPayoutsFlag, now: number = Date.now()): boolean {
  if (!settings.directPayoutsEnabled) return false
  if (settings.directPayoutsEnabledUntil && new Date(settings.directPayoutsEnabledUntil).getTime() <= now) return false
  return true
}

/**
 * When the stored flag is still on but its auto-disable time has passed,
 * that time (the admin page notes it under the OFF toggle); otherwise null.
 */
export function directPayoutsExpiredAt(settings: DirectPayoutsFlag, now: number = Date.now()): Date | null {
  if (!settings.directPayoutsEnabled || !settings.directPayoutsEnabledUntil) return null
  if (isDirectPayoutsEnabled(settings, now)) return null
  return new Date(settings.directPayoutsEnabledUntil)
}
