import { revalidateTag, unstable_cache } from "next/cache"
import { connection } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { isAdminRole } from "@/lib/launch-waves"
import { wavesForViewer, type WaveHint } from "@/lib/launch-waves-ui"
import { getLaunchWaves } from "@/lib/platform-settings"

// S1b-b1 - server-side W1 reads for pages that change when W1 is closed
// but aren't held (/register via signupsClosedForViewer()). The holding
// page itself is decided in src/proxy.ts (S1b-b1-fix) so the public pages
// stay static/ISR; the pure decision is holdingPageApplies() /
// w1ProxyAction() in src/lib/launch-waves.ts (self-tested).

export const LAUNCH_WAVES_CACHE_TAG = "launch-waves"

async function fetchW1Open(): Promise<boolean> {
  // Read-only (getPlatformSettings() upserts). A missing row means closed, same as isWaveOpen().
  const row = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
    select: { waveDiscoveryOpen: true },
  })
  return row?.waveDiscoveryOpen === true
}

const getCachedW1Open = unstable_cache(fetchW1Open, ["launch-waves-w1-v1"], {
  tags: [LAUNCH_WAVES_CACHE_TAG],
  revalidate: 30,
})

/** Called after an admin save so /register sees the new W1 state
 * at once ({ expire: 0 } = immediate, same as revalidateDesignTokens()).
 * The holding-page proxy keeps its own W1 cache: per instance, <=30s stale. */
export function revalidateLaunchWaves() {
  revalidateTag(LAUNCH_WAVES_CACHE_TAG, { expire: 0 })
}

/**
 * W1 state for display only. A failed read counts as open: the holding page
 * is a courtesy, not the enforcement (register / Google sign-up check the
 * switch themselves), and a DB blip must not blank the whole public site.
 */
export async function isW1OpenForDisplay(): Promise<boolean> {
  try {
    return await getCachedW1Open()
  } catch (err) {
    console.warn("[launch-waves] W1 read failed, not showing the holding page", err)
    return true
  }
}

/** Same check for a page that isn't held but changes when W1 is closed (/register). */
export async function signupsClosedForViewer(): Promise<boolean> {
  await connection()
  if (await isW1OpenForDisplay()) return false
  const session = await getServerSession(authOptions)
  return !isAdminRole((session?.user as { role?: string } | undefined)?.role)
}

/**
 * S1b-b2 - all four waves as this viewer should see them (ADMIN bypass,
 * same as the server gates). Display only: a failed read counts as open,
 * the routes still refuse and the client maps their 403 to a friendly line.
 */
export async function getLaunchWavesForViewer(): Promise<WaveHint> {
  await connection()
  let hint: WaveHint | null = null
  try {
    hint = await getLaunchWaves()
  } catch (err) {
    console.warn("[launch-waves] wave read failed, showing everything open", err)
  }
  const session = await getServerSession(authOptions)
  return wavesForViewer(hint, isAdminRole((session?.user as { role?: string } | undefined)?.role))
}
