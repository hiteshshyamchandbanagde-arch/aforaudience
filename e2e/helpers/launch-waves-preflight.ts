/**
 * QA pre-flight for the launch waves (e2e hardening, HANDOFF Part 71).
 *
 * The suite expects all four launch waves open on QA. On 11 Nov W1 was left
 * OFF and every shard went red with about 50 unrelated errors. global-setup.ts
 * now reads GET /api/platform-settings/launch-waves (the same read-only hint
 * the app uses; it is backed by the PlatformSettings singleton) before any
 * spec runs and stops the run with the one message built here.
 *
 * Pure: no network, no database, so scripts/e2e-preflight.test.ts can test it.
 * Never writes the waves; turning one back on is Hitesh's call.
 */

/** The four waves, in order: API key, PlatformSettings column. */
export const LAUNCH_WAVES = [
  { key: "W1", field: "waveDiscoveryOpen" },
  { key: "W2", field: "waveOnboardingOpen" },
  { key: "W3", field: "waveTicketsOpen" },
  { key: "W4", field: "waveDirectBookingsOpen" },
] as const;

const FIX = "Turn it back on in Admin → Settings → Launch waves, then re-run.";

/** "W1 (waveDiscoveryOpen)" */
function waveName(w: (typeof LAUNCH_WAVES)[number]): string {
  return `${w.key} (${w.field})`;
}

/**
 * The waves the response says are not open. Anything that is not exactly
 * `true` (false, missing, wrong type) counts as closed: the suite cannot
 * trust a wave it can't see.
 */
export function closedWaves(body: unknown): string[] {
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  return LAUNCH_WAVES.filter((w) => rec[w.key] !== true).map(waveName);
}

/**
 * The pre-flight message for a GET /api/platform-settings/launch-waves body,
 * or null when all four waves are open.
 */
export function launchWavesPreflightMessage(body: unknown): string | null {
  const closed = closedWaves(body);
  if (closed.length === 0) return null;
  if (closed.length === 1) {
    return `QA pre-flight: launch wave ${closed[0]} is OFF on QA. The suite expects all four waves open. ${FIX}`;
  }
  return (
    `QA pre-flight: launch waves ${closed.join(", ")} are OFF on QA. The suite expects all four waves open. ` +
    FIX.replace("Turn it back on", "Turn them back on")
  );
}
