import { unstable_cache } from "next/cache"
import { connection } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { holdingPageApplies, isAdminRole } from "@/lib/launch-waves"

// S1b-b1 - server-side W1 holding-page check, used by the layouts of the
// held discovery segments and by the homepage. The pure decision lives in
// holdingPageApplies() (src/lib/launch-waves.ts, self-tested); this file
// only does the I/O: the W1 switch (cached 30s, busted by the admin save)
// and the session role for the ADMIN bypass.
//
// Why layouts and not a proxy: this Next version's layouts render on the
// server on every request to their segment, and each held segment is held
// as a whole, so a layout that doesn't re-render between sibling pages
// can't show the wrong state. No proxy file exists in this app and adding
// one would run on every request (assets, API) just for this.

export const LAUNCH_WAVES_CACHE_TAG = "launch-waves"

async function fetchW1Open(): Promise<boolean> {
  // Read-only (getPlatformSettings() upserts) - this runs on every public
  // page view. A missing row means closed, same as isWaveOpen().
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

/** True when this request should get the holding page instead of `pathname`. */
export async function shouldShowHoldingPage(pathname: string): Promise<boolean> {
  // Always per-request: the answer depends on the viewer's session, so a
  // held page must never be prerendered/ISR-cached either way.
  await connection()
  const w1Open = await isW1OpenForDisplay()
  if (w1Open) return false
  const session = await getServerSession(authOptions)
  const role = (session?.user as { role?: string } | undefined)?.role
  return holdingPageApplies(pathname, w1Open, isAdminRole(role))
}

/** Same check for a page that isn't held but changes when W1 is closed (/register). */
export async function signupsClosedForViewer(): Promise<boolean> {
  await connection()
  if (await isW1OpenForDisplay()) return false
  const session = await getServerSession(authOptions)
  return !isAdminRole((session?.user as { role?: string } | undefined)?.role)
}
